#!/usr/bin/env bash

engine_die() {
  echo "$*" >&2
  exit 1
}

engine_require() {
  command -v "$1" >/dev/null || engine_die "Missing required command: $1"
}

engine_configure() {
  local library_dir repository_dir
  library_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repository_dir="$(cd "${library_dir}/.." && pwd)"
  ENGINE_REPO_DIR="${repository_dir}"
  ENGINE_GAME_DIR="$(realpath -e "${repository_dir}/..")"
  # shellcheck source=../config/engines.env
  source "${repository_dir}/config/engines.env"
  engine_validate_configuration
}

engine_validate_configuration() {
  local value
  for value in "${STOCKFISH_ID}" "${PIKAFISH_ID}" "${FAIRY_STOCKFISH_ID}"; do
    [[ "${value}" =~ ^[a-z0-9][a-z0-9._-]*$ ]] || engine_die "Unsafe engine ID in reviewed configuration."
  done
  for value in "${STOCKFISH_ARCHIVE}" "${PIKAFISH_ARCHIVE}" "${STOCKFISH_BINARY}"; do
    [[ "${value}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || engine_die "Unsafe artifact name in reviewed configuration."
  done
  for value in "${STOCKFISH_SHA256}" "${PIKAFISH_SHA256}"; do
    [[ "${value}" =~ ^[0-9a-f]{64}$ ]] || engine_die "Invalid SHA-256 in reviewed configuration."
  done
  for value in "${STOCKFISH_COMMIT}" "${PIKAFISH_COMMIT}" "${FAIRY_STOCKFISH_COMMIT}"; do
    [[ "${value}" =~ ^[0-9a-f]{40}$ ]] || engine_die "Invalid Git object in reviewed configuration."
  done
  [[ "${STOCKFISH_SIZE}" =~ ^[1-9][0-9]+$ && "${PIKAFISH_SIZE}" =~ ^[1-9][0-9]+$ ]] \
    || engine_die "Invalid archive size in reviewed configuration."
  [[ "${STOCKFISH_URL}" == https://* && "${PIKAFISH_URL}" == https://* && "${FAIRY_STOCKFISH_REPOSITORY}" == https://* ]] \
    || engine_die "Reviewed engine sources must use HTTPS."
}

engine_model_root() {
  local requested canonical user_home
  requested="${GAME_MODEL_ROOT:-${ENGINE_GAME_DIR}/.local/models}"
  [[ "${requested}" == /* ]] || engine_die "GAME_MODEL_ROOT must be an absolute path."
  canonical="$(realpath -m -- "${requested}")"
  [[ "${canonical}" == "${requested}" ]] || engine_die "GAME_MODEL_ROOT must be canonical and contain no symlink or '..' aliases."
  user_home="$(getent passwd "$(id -u)" | cut -d: -f6)"
  case "${canonical}" in
    /|"${user_home}"|"${ENGINE_GAME_DIR}"|"${ENGINE_REPO_DIR}"|"${ENGINE_REPO_DIR}"/*)
      engine_die "Refusing broad or source-tree GAME_MODEL_ROOT: ${canonical}"
      ;;
  esac
  mkdir -p -- "${canonical}"
  [[ -d "${canonical}" && ! -L "${canonical}" && -O "${canonical}" && -w "${canonical}" ]] \
    || engine_die "GAME_MODEL_ROOT must be an owned, writable, non-symlink directory."
  [[ "$(realpath -e -- "${canonical}")" == "${canonical}" ]] \
    || engine_die "GAME_MODEL_ROOT resolves through a symlink: ${canonical}"
  printf '%s\n' "${canonical}"
}

engine_assert_child() {
  local root child child_canonical parent_real
  root="$1"
  child="$2"
  [[ "${child}" == "${root}/"* && "${child}" != "${root}" ]] || engine_die "Unsafe install target: ${child}"
  child_canonical="$(realpath -m -- "${child}")"
  [[ "${child_canonical}" == "${child}" ]] || engine_die "Install target must be canonical: ${child}"
  [[ ! -L "${child}" ]] || engine_die "Refusing symlink install target: ${child}"
  parent_real="$(realpath -m -- "$(dirname "${child}")")"
  [[ "${parent_real}" == "${root}" || "${parent_real}" == "${root}/"* ]] \
    || engine_die "Install target escapes GAME_MODEL_ROOT: ${child}"
}

engine_verify_blob() {
  local file_path expected_size expected_sha actual_size actual_sha
  file_path="$1"
  expected_size="$2"
  expected_sha="$3"
  [[ -f "${file_path}" && ! -L "${file_path}" ]] || engine_die "Downloaded artifact is not a regular file."
  actual_size="$(stat -c %s -- "${file_path}")"
  [[ "${actual_size}" == "${expected_size}" ]] \
    || engine_die "Artifact size mismatch: expected ${expected_size}, got ${actual_size}."
  actual_sha="$(sha256sum -- "${file_path}" | cut -d' ' -f1)"
  [[ "${actual_sha}" == "${expected_sha}" ]] \
    || engine_die "Artifact SHA-256 mismatch: expected ${expected_sha}, got ${actual_sha}."
}

engine_validate_archive_paths() {
  local archive kind list_file metadata_file entry normalized slash_normalized
  archive="$1"
  kind="$2"
  list_file="$3"
  metadata_file="${list_file}.metadata"
  if [[ "${kind}" == tar ]]; then
    tar -tf "${archive}" > "${list_file}"
    LC_ALL=C tar -tvf "${archive}" > "${metadata_file}"
    if grep -Eq '^[^d-]' "${metadata_file}"; then
      engine_die "Archive contains a link or special file."
    fi
  else
    7z l -slt "${archive}" > "${metadata_file}"
    awk 'seen && /^Path = / { sub(/^Path = /, ""); print } /^----------$/ { seen=1 }' "${metadata_file}" > "${list_file}"
    if grep -Eq '^(Symbolic Link|Hard Link) = |^Attributes = .*[[:space:]][^d-][rwxstST-]{9}([[:space:]]|$)' "${metadata_file}"; then
      engine_die "Archive contains a link or special file."
    fi
  fi
  while IFS= read -r entry; do
    normalized="${entry#./}"
    [[ -n "${normalized}" ]] || continue
    slash_normalized="${normalized//\\//}"
    [[ "${slash_normalized}" != /* && "${slash_normalized}" != ?:/* && "${slash_normalized}" != ".." && "${slash_normalized}" != ../* && "${slash_normalized}" != */../* && "${slash_normalized}" != */.. ]] \
      || engine_die "Archive contains an unsafe path: ${entry}"
  done < "${list_file}"
}

engine_extract_archive() {
  local archive kind destination list_file unexpected_link
  archive="$1"
  kind="$2"
  destination="$3"
  list_file="${destination}.paths"
  mkdir -p -- "${destination}"
  engine_validate_archive_paths "${archive}" "${kind}" "${list_file}"
  if [[ "${kind}" == tar ]]; then
    tar --extract --file "${archive}" --directory "${destination}" --no-same-owner --no-same-permissions
  else
    7z x -y "-o${destination}" "${archive}" >/dev/null
  fi
  unexpected_link="$(find "${destination}" -type l -print -quit)"
  [[ -z "${unexpected_link}" ]] || engine_die "Archive extracted a symlink, refusing: ${unexpected_link}"
}

engine_cpu_has_avxvnni() {
  [[ -r /proc/cpuinfo ]] && grep -Eqw 'avx_vnni|avxvnni' /proc/cpuinfo
}

engine_smoke_uci() {
  local binary expected_identity engine_output
  binary="$1"
  expected_identity="$2"
  [[ -f "${binary}" && ! -L "${binary}" && -x "${binary}" ]] || engine_die "Engine smoke-test target is unsafe."
  if ! engine_output="$(printf 'uci\nisready\nquit\n' | timeout 15 "${binary}")"; then
    engine_die "${expected_identity} UCI process failed or timed out."
  fi
  [[ "${engine_output}" == *uciok* && "${engine_output}" == *readyok* ]] \
    || engine_die "${expected_identity} UCI readiness check failed."
  [[ "${engine_output}" == *"${expected_identity}"* ]] || engine_die "Unexpected ${expected_identity} identity."
}

engine_receipt_binary() {
  local install_dir receipt relative binary_real
  install_dir="$1"
  receipt="${install_dir}/receipt.json"
  [[ -f "${receipt}" && ! -L "${receipt}" ]] || engine_die "Missing non-symlink receipt: ${receipt}"
  relative="$(jq -er '.binary.relative_path' "${receipt}")"
  [[ "${relative}" != /* && "${relative}" != ".." && "${relative}" != ../* && "${relative}" != */../* && "${relative}" != */.. ]] \
    || engine_die "Unsafe binary path in receipt."
  binary_real="$(realpath -e -- "${install_dir}/${relative}")"
  [[ "${binary_real}" == "${install_dir}/"* && -f "${binary_real}" && ! -L "${install_dir}/${relative}" ]] \
    || engine_die "Receipt binary escapes its install directory."
  printf '%s\n' "${binary_real}"
}

engine_write_receipt() {
  local receipt engine_id version role source_url source_commit archive_name archive_size archive_sha binary_relative binary_sha installed_at
  receipt="$1"; engine_id="$2"; version="$3"; role="$4"; source_url="$5"; source_commit="$6"
  archive_name="$7"; archive_size="$8"; archive_sha="$9"; binary_relative="${10}"; binary_sha="${11}"
  installed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  jq -n \
    --arg engine_id "${engine_id}" \
    --arg version "${version}" \
    --arg role "${role}" \
    --arg source_url "${source_url}" \
    --arg source_commit "${source_commit}" \
    --arg archive_name "${archive_name}" \
    --argjson archive_size "${archive_size}" \
    --arg archive_sha256 "${archive_sha}" \
    --arg binary_relative_path "${binary_relative}" \
    --arg binary_sha256 "${binary_sha}" \
    --arg installed_at "${installed_at}" \
    '{schema_version:1, engine_id:$engine_id, version:$version, role:$role, source:{url:$source_url,commit:$source_commit}, archive:{name:$archive_name,size:$archive_size,sha256:$archive_sha256}, binary:{relative_path:$binary_relative_path,sha256:$binary_sha256}, installed_at:$installed_at}' \
    > "${receipt}"
}
