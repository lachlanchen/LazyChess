#!/usr/bin/env bash
set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=engine-lib.sh
source "${script_dir}/engine-lib.sh"
engine_configure

if [[ "${CONFIRM_ENGINE_DOWNLOAD:-}" != "yes" ]]; then
  echo "Engine setup is opt-in. Re-run with CONFIRM_ENGINE_DOWNLOAD=yes." >&2
  exit 2
fi

selection=all
if [[ "${1:-}" == --engine && -n "${2:-}" && -z "${3:-}" ]]; then
  selection="$2"
elif [[ $# -ne 0 ]]; then
  echo "Usage: CONFIRM_ENGINE_DOWNLOAD=yes $0 [--engine stockfish|pikafish|fairy-stockfish|all]" >&2
  exit 2
fi
case "${selection}" in stockfish|pikafish|fairy-stockfish|all) ;; *) echo "Unknown engine: ${selection}" >&2; exit 2 ;; esac

for command_name in realpath getent id flock mktemp find jq sha256sum stat file timeout; do engine_require "${command_name}"; done
model_root="$(engine_model_root)"
lock_path="${model_root}/.install.lock"
[[ ! -L "${lock_path}" ]] || engine_die "Refusing symlink installer lock: ${lock_path}"
exec 9>>"${lock_path}"
flock 9
[[ -f "${lock_path}" && ! -L "${lock_path}" && -O "${lock_path}" ]] \
  || engine_die "Installer lock is not an owned regular file."
[[ "$(stat -c %h -- "${lock_path}")" == 1 ]] || engine_die "Installer lock must not be hard-linked."
[[ "$(stat -Lc '%d:%i' "/proc/$$/fd/9")" == "$(stat -Lc '%d:%i' "${lock_path}")" ]] \
  || engine_die "Installer lock path changed while acquiring the lock."

cleanup_dir=
cleanup() {
  if [[ -n "${cleanup_dir}" && -d "${cleanup_dir}" && "${cleanup_dir}" == "${model_root}/.install."* ]]; then
    rm -rf -- "${cleanup_dir}"
  fi
}
trap cleanup EXIT INT TERM

install_prebuilt() {
  local engine_name engine_id version role source_url source_commit archive_name archive_size archive_sha archive_kind binary_name
  local install_dir archive_path extract_dir package_dir selected_binary selected_relative binary_sha candidate
  engine_name="$1"; engine_id="$2"; version="$3"; role="$4"; source_url="$5"; source_commit="$6"
  archive_name="$7"; archive_size="$8"; archive_sha="$9"; archive_kind="${10}"; binary_name="${11}"
  install_dir="${model_root}/${engine_id}"
  engine_assert_child "${model_root}" "${install_dir}"
  if [[ -e "${install_dir}" ]]; then
    [[ -d "${install_dir}" && ! -L "${install_dir}" ]] || engine_die "Unsafe existing install: ${install_dir}"
    "${script_dir}/verify-engine.sh" --engine "${engine_name}"
    return
  fi
  engine_require curl
  [[ "${archive_kind}" != tar ]] || engine_require tar
  [[ "${archive_kind}" != 7z ]] || engine_require 7z
  if ! engine_cpu_has_avxvnni; then
    engine_die "${engine_name} quality lane requires AVX-VNNI; this CPU does not advertise it."
  fi

  cleanup_dir="$(mktemp -d "${model_root}/.install.${engine_name}.XXXXXX")"
  archive_path="${cleanup_dir}/${archive_name}"
  extract_dir="${cleanup_dir}/extract"
  package_dir="${cleanup_dir}/package"
  curl --fail --location --proto '=https' --tlsv1.2 --retry 3 --output "${archive_path}" "${source_url}"
  engine_verify_blob "${archive_path}" "${archive_size}" "${archive_sha}"
  engine_extract_archive "${archive_path}" "${archive_kind}" "${extract_dir}"

  selected_binary=
  if [[ "${engine_name}" == stockfish ]]; then
    selected_binary="$(find "${extract_dir}" -type f -name "${binary_name}" -print -quit)"
  else
    while IFS= read -r candidate; do
      if file --brief "${candidate}" | grep -q '^ELF ' && [[ "$(basename "${candidate}")" != *.exe ]]; then
        selected_binary="${candidate}"
        break
      fi
    done < <(find "${extract_dir}" -type f -iname '*avxvnni*' -print | sort)
  fi
  [[ -n "${selected_binary}" && -f "${selected_binary}" && ! -L "${selected_binary}" ]] \
    || engine_die "Could not find the reviewed Linux AVX-VNNI binary in ${archive_name}."
  file --brief "${selected_binary}" | grep -q '^ELF ' || engine_die "Selected engine is not an ELF executable."
  selected_relative="$(realpath --relative-to="${extract_dir}" "${selected_binary}")"
  mkdir -p -- "${package_dir}"
  mv -- "${extract_dir}" "${package_dir}/payload"
  chmod 0755 -- "${package_dir}/payload/${selected_relative}"
  if [[ "${engine_name}" == stockfish ]]; then
    engine_smoke_uci "${package_dir}/payload/${selected_relative}" Stockfish
  else
    engine_smoke_uci "${package_dir}/payload/${selected_relative}" Pikafish
  fi
  binary_sha="$(sha256sum -- "${package_dir}/payload/${selected_relative}" | cut -d' ' -f1)"
  engine_write_receipt "${package_dir}/receipt.json" "${engine_id}" "${version}" "${role}" "${source_url}" "${source_commit}" \
    "${archive_name}" "${archive_size}" "${archive_sha}" "payload/${selected_relative}" "${binary_sha}"
  mv --no-clobber --no-target-directory -- "${package_dir}" "${install_dir}"
  [[ ! -e "${package_dir}" && -d "${install_dir}" && ! -L "${install_dir}" ]] \
    || engine_die "Install target appeared concurrently; no package was accepted."
  rm -rf -- "${cleanup_dir}"
  cleanup_dir=
  "${script_dir}/verify-engine.sh" --engine "${engine_name}"
}

install_fairy_stockfish() {
  local install_dir source_dir package_dir binary_path binary_sha actual_commit
  install_dir="${model_root}/${FAIRY_STOCKFISH_ID}"
  engine_assert_child "${model_root}" "${install_dir}"
  if [[ -e "${install_dir}" ]]; then
    [[ -d "${install_dir}" && ! -L "${install_dir}" ]] || engine_die "Unsafe existing install: ${install_dir}"
    "${script_dir}/verify-engine.sh" --engine fairy-stockfish
    return
  fi
  for command_name in git make g++; do engine_require "${command_name}"; done
  cleanup_dir="$(mktemp -d "${model_root}/.install.fairy-stockfish.XXXXXX")"
  package_dir="${cleanup_dir}/package"
  source_dir="${package_dir}/source"
  mkdir -p -- "${package_dir}/bin"
  git init --quiet "${source_dir}"
  git -C "${source_dir}" remote add origin "${FAIRY_STOCKFISH_REPOSITORY}"
  git -C "${source_dir}" fetch --quiet --depth=1 origin "${FAIRY_STOCKFISH_COMMIT}"
  git -C "${source_dir}" checkout --quiet --detach FETCH_HEAD
  actual_commit="$(git -C "${source_dir}" rev-parse HEAD)"
  [[ "${actual_commit}" == "${FAIRY_STOCKFISH_COMMIT}" ]] || engine_die "Fairy-Stockfish source pin mismatch."
  git -C "${source_dir}" fsck --strict --no-progress
  make -C "${source_dir}/src" -j2 build ARCH="${FAIRY_STOCKFISH_ARCH}" largeboards=yes nnue=no
  binary_path="${package_dir}/bin/fairy-stockfish-largeboard-x86-64"
  cp -- "${source_dir}/src/stockfish" "${binary_path}"
  chmod 0755 -- "${binary_path}"
  engine_smoke_uci "${binary_path}" Fairy-Stockfish
  binary_sha="$(sha256sum -- "${binary_path}" | cut -d' ' -f1)"
  engine_write_receipt "${package_dir}/receipt.json" "${FAIRY_STOCKFISH_ID}" "${FAIRY_STOCKFISH_VERSION}" "shogi-fallback" \
    "${FAIRY_STOCKFISH_REPOSITORY}" "${FAIRY_STOCKFISH_COMMIT}" "" 0 "" "bin/$(basename "${binary_path}")" "${binary_sha}"
  mv --no-clobber --no-target-directory -- "${package_dir}" "${install_dir}"
  [[ ! -e "${package_dir}" && -d "${install_dir}" && ! -L "${install_dir}" ]] \
    || engine_die "Install target appeared concurrently; no package was accepted."
  rm -rf -- "${cleanup_dir}"
  cleanup_dir=
  "${script_dir}/verify-engine.sh" --engine fairy-stockfish
}

if [[ "${selection}" == stockfish || "${selection}" == all ]]; then
  install_prebuilt stockfish "${STOCKFISH_ID}" "${STOCKFISH_VERSION}" international-chess "${STOCKFISH_URL}" "${STOCKFISH_COMMIT}" \
    "${STOCKFISH_ARCHIVE}" "${STOCKFISH_SIZE}" "${STOCKFISH_SHA256}" tar "${STOCKFISH_BINARY}"
fi
if [[ "${selection}" == pikafish || "${selection}" == all ]]; then
  install_prebuilt pikafish "${PIKAFISH_ID}" "${PIKAFISH_VERSION}" xiangqi "${PIKAFISH_URL}" "${PIKAFISH_COMMIT}" \
    "${PIKAFISH_ARCHIVE}" "${PIKAFISH_SIZE}" "${PIKAFISH_SHA256}" 7z avxvnni
fi
if [[ "${selection}" == fairy-stockfish || "${selection}" == all ]]; then
  install_fairy_stockfish
fi

echo "Requested engine lane '${selection}' is installed and verified under ${model_root}."
