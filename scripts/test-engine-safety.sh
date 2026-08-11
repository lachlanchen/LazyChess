#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=engine-lib.sh
source "${script_dir}/engine-lib.sh"
engine_configure

safety_temp="$(mktemp -d)"
cleanup_safety() {
  [[ -n "${safety_temp}" && -d "${safety_temp}" && "${safety_temp}" == /tmp/* ]] && rm -rf -- "${safety_temp}"
}
trap cleanup_safety EXIT INT TERM

safe_root="${safety_temp}/models"
GAME_MODEL_ROOT="${safe_root}"
[[ "$(engine_model_root)" == "${safe_root}" ]]
mkdir -p "${safety_temp}/real-models"
ln -s "${safety_temp}/real-models" "${safety_temp}/linked-models"
if (GAME_MODEL_ROOT="${safety_temp}/linked-models" engine_model_root >/dev/null 2>&1); then
  echo "Symlink model root was not rejected." >&2
  exit 1
fi
if (GAME_MODEL_ROOT=/ engine_model_root >/dev/null 2>&1); then
  echo "Broad model root was not rejected." >&2
  exit 1
fi
if (GAME_MODEL_ROOT="${ENGINE_REPO_DIR}/unsafe-models" engine_model_root >/dev/null 2>&1); then
  echo "Chess source-tree model root was not rejected." >&2
  exit 1
fi
if (GAME_MODEL_ROOT="${safe_root}/../models" engine_model_root >/dev/null 2>&1); then
  echo "Non-canonical model root was not rejected." >&2
  exit 1
fi
if (engine_assert_child "${safe_root}" "${safety_temp}/escape" >/dev/null 2>&1); then
  echo "Escaping install child was not rejected." >&2
  exit 1
fi
mkdir -p "${safety_temp}/outside"
ln -s "${safety_temp}/outside" "${safe_root}/linked-parent"
if (engine_assert_child "${safe_root}" "${safe_root}/linked-parent/engine" >/dev/null 2>&1); then
  echo "Symlink-parent install child was not rejected." >&2
  exit 1
fi

mkdir -p "${safety_temp}/archive-safe"
printf 'safe\n' > "${safety_temp}/archive-safe/file"
tar -cf "${safety_temp}/safe.tar" -C "${safety_temp}/archive-safe" file
engine_validate_archive_paths "${safety_temp}/safe.tar" tar "${safety_temp}/safe.paths"
ln -s /tmp "${safety_temp}/archive-safe/link"
tar -cf "${safety_temp}/linked.tar" -C "${safety_temp}/archive-safe" link
if (engine_validate_archive_paths "${safety_temp}/linked.tar" tar "${safety_temp}/linked.paths" >/dev/null 2>&1); then
  echo "Tar symlink entry was not rejected before extraction." >&2
  exit 1
fi
if command -v 7z >/dev/null; then
  7z a -snl "${safety_temp}/linked.7z" "${safety_temp}/archive-safe/link" >/dev/null
  if (engine_validate_archive_paths "${safety_temp}/linked.7z" 7z "${safety_temp}/linked-7z.paths" >/dev/null 2>&1); then
    echo "7z symlink entry was not rejected before extraction." >&2
    exit 1
  fi
fi

hardlink_root="${safety_temp}/hardlink-root"
mkdir -p "${hardlink_root}"
printf 'must remain intact\n' > "${safety_temp}/protected"
ln "${safety_temp}/protected" "${hardlink_root}/.install.lock"
hardlink_output=
if hardlink_output="$(GAME_MODEL_ROOT="${hardlink_root}" CONFIRM_ENGINE_DOWNLOAD=yes bash "${script_dir}/setup-engine.sh" --engine stockfish 2>&1)"; then
  echo "Hard-linked installer lock was not rejected." >&2
  exit 1
fi
[[ "${hardlink_output}" == *'must not be hard-linked'* ]] || { echo "Installer did not reach the hard-link guard." >&2; exit 1; }
[[ "$(cat "${safety_temp}/protected")" == "must remain intact" ]] || { echo "Hard-linked file was modified." >&2; exit 1; }
echo "Engine path safety checks passed."
