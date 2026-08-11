#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=engine-lib.sh
source "${script_dir}/engine-lib.sh"
engine_configure

selection=all
if [[ "${1:-}" == --engine && -n "${2:-}" && -z "${3:-}" ]]; then
  selection="$2"
elif [[ $# -ne 0 ]]; then
  echo "Usage: $0 [--engine stockfish|pikafish|fairy-stockfish|all]" >&2
  exit 2
fi
case "${selection}" in stockfish|pikafish|fairy-stockfish|all) ;; *) echo "Unknown engine: ${selection}" >&2; exit 2 ;; esac

for command_name in realpath getent id jq sha256sum git timeout; do engine_require "${command_name}"; done
model_root="$(engine_model_root)"

verify_one() {
  local engine_name engine_id expected_version expected_role expected_url expected_commit expected_archive expected_size expected_archive_sha
  local install_dir receipt binary_path binary_sha source_dir unexpected_link expected_identity
  engine_name="$1"
  case "${engine_name}" in
    stockfish)
      engine_id="${STOCKFISH_ID}"; expected_version="${STOCKFISH_VERSION}"; expected_role=international-chess
      expected_url="${STOCKFISH_URL}"; expected_commit="${STOCKFISH_COMMIT}"; expected_archive="${STOCKFISH_ARCHIVE}"
      expected_size="${STOCKFISH_SIZE}"; expected_archive_sha="${STOCKFISH_SHA256}"
      expected_identity=Stockfish
      ;;
    pikafish)
      engine_id="${PIKAFISH_ID}"; expected_version="${PIKAFISH_VERSION}"; expected_role=xiangqi
      expected_url="${PIKAFISH_URL}"; expected_commit="${PIKAFISH_COMMIT}"; expected_archive="${PIKAFISH_ARCHIVE}"
      expected_size="${PIKAFISH_SIZE}"; expected_archive_sha="${PIKAFISH_SHA256}"
      expected_identity=Pikafish
      ;;
    fairy-stockfish)
      engine_id="${FAIRY_STOCKFISH_ID}"; expected_version="${FAIRY_STOCKFISH_VERSION}"; expected_role=shogi-fallback
      expected_url="${FAIRY_STOCKFISH_REPOSITORY}"; expected_commit="${FAIRY_STOCKFISH_COMMIT}"; expected_archive=""
      expected_size=0; expected_archive_sha=""
      expected_identity=Fairy-Stockfish
      ;;
  esac
  install_dir="${model_root}/${engine_id}"
  engine_assert_child "${model_root}" "${install_dir}"
  [[ -d "${install_dir}" && ! -L "${install_dir}" && "$(realpath -e "${install_dir}")" == "${install_dir}" ]] \
    || { echo "${engine_name} is not safely installed under ${model_root}." >&2; return 2; }
  unexpected_link="$(find "${install_dir}" -type l -print -quit)"
  [[ -z "${unexpected_link}" ]] || engine_die "Installed package contains a symlink, refusing: ${unexpected_link}"
  receipt="${install_dir}/receipt.json"
  jq -e \
    --arg id "${engine_id}" --arg version "${expected_version}" --arg role "${expected_role}" \
    --arg url "${expected_url}" --arg commit "${expected_commit}" --arg archive "${expected_archive}" \
    --argjson size "${expected_size}" --arg sha "${expected_archive_sha}" \
    '.schema_version == 1 and .engine_id == $id and .version == $version and .role == $role and .source.url == $url and .source.commit == $commit and .archive.name == $archive and .archive.size == $size and .archive.sha256 == $sha' \
    "${receipt}" >/dev/null || engine_die "${engine_name} receipt does not match reviewed configuration."
  binary_path="$(engine_receipt_binary "${install_dir}")"
  binary_sha="$(sha256sum -- "${binary_path}" | cut -d' ' -f1)"
  [[ "${binary_sha}" == "$(jq -er '.binary.sha256' "${receipt}")" ]] || engine_die "${engine_name} binary checksum mismatch."
  [[ -x "${binary_path}" ]] || engine_die "${engine_name} binary is not executable."
  if [[ "${engine_name}" != fairy-stockfish ]] && ! engine_cpu_has_avxvnni; then
    engine_die "${engine_name} is pinned to AVX-VNNI but this CPU does not advertise support."
  fi
  if [[ "${engine_name}" == fairy-stockfish ]]; then
    source_dir="${install_dir}/source"
    [[ -d "${source_dir}/.git" && ! -L "${source_dir}" ]] || engine_die "Missing Fairy-Stockfish source receipt."
    [[ "$(git -C "${source_dir}" rev-parse HEAD)" == "${FAIRY_STOCKFISH_COMMIT}" ]] || engine_die "Fairy-Stockfish source commit mismatch."
    git -C "${source_dir}" fsck --strict --no-progress
    git -C "${source_dir}" diff --quiet HEAD -- || engine_die "Fairy-Stockfish tracked source has local changes."
    git -C "${source_dir}" diff --cached --quiet || engine_die "Fairy-Stockfish source index has local changes."
  fi
  engine_smoke_uci "${binary_path}" "${expected_identity}"
  echo "Verified ${engine_name}: ${engine_id}."
}

if [[ "${selection}" == stockfish || "${selection}" == all ]]; then verify_one stockfish; fi
if [[ "${selection}" == pikafish || "${selection}" == all ]]; then verify_one pikafish; fi
if [[ "${selection}" == fairy-stockfish || "${selection}" == all ]]; then verify_one fairy-stockfish; fi
