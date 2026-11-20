#!/bin/bash
# Install the latest public Recap release into $HOME/Tools/recap.
# Does not read or write the Chrome profile.
set -euo pipefail

home=$(cd -- "$HOME" && pwd -P)
dest=${RECAP_DIR:-$home/Tools/recap}
log_dir=$home/Library/Logs
log_file=$log_dir/recap-update.log
api_url=https://api.github.com/repos/tungdd97/recap/releases/latest

force=0
check_only=0
for arg in "$@"; do
  case $arg in
    --force) force=1 ;;
    --check) check_only=1 ;;
    *)
      echo "usage: recap-update [--check] [--force]" >&2
      exit 2
      ;;
  esac
done

log() {
  mkdir -p -- "$log_dir"
  printf '%s %s\n' "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$*" >>"$log_file"
}

manifest_version() {
  local file=$1 line
  if [[ ! -f $file ]]; then
    printf '\n'
    return 0
  fi
  line=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file")
  printf '%s\n' "$line" | sed -n '1p'
}

# True when $1 is a strictly newer dotted version than $2.
version_gt() {
  local left=$1 right=$2
  local IFS=.
  # shellcheck disable=SC2206
  local a=($left) b=($right)
  local i n av bv
  n=${#a[@]}
  if ((${#b[@]} > n)); then n=${#b[@]}; fi
  for ((i = 0; i < n; i++)); do
    av=${a[i]:-0}
    bv=${b[i]:-0}
    if ((10#$av > 10#$bv)); then return 0; fi
    if ((10#$av < 10#$bv)); then return 1; fi
  done
  return 1
}

notify() {
  local ver=$1
  osascript -e "display notification \"Recap có bản mới ${ver}. Vào chrome://extensions bấm Reload.\" with title \"Recap\"" || true
}

prune_backups() {
  local tools=$home/Tools path keep=0 listing
  listing=$(ls -1dt "$tools"/recap.bak.* 2>/dev/null || true)
  [[ -n $listing ]] || return 0
  while IFS= read -r path; do
    [[ -n $path ]] || continue
    keep=$((keep + 1))
    if ((keep > 2)); then
      case $path in
        "$tools"/recap.bak.*) rm -rf -- "$path" ;;
        *) ;;
      esac
    fi
  done <<EOF
$listing
EOF
}

body=$(curl -fsSL -H "Accept: application/vnd.github+json" -H "User-Agent: recap-update" "$api_url") || {
  log "release lookup failed"
  echo "could not read the latest release" >&2
  exit 1
}

tag=$(printf '%s\n' "$body" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | sed -n '1p')
latest=${tag#v}
installed=$(manifest_version "$dest/manifest.json")
installed=${installed//$'\r'/}

if ((check_only)); then
  if [[ -n $installed ]]; then
    printf 'installed %s\n' "$installed"
  else
    printf 'installed none\n'
  fi
  if [[ -n $latest ]]; then
    printf 'latest %s\n' "$latest"
  else
    printf 'latest unknown\n'
  fi
  exit 0
fi

if [[ -z $latest ]]; then
  log "latest release has no tag"
  exit 1
fi

if ((force == 0)) && [[ -n $installed ]] && ! version_gt "$latest" "$installed"; then
  exit 0
fi

tmp=$(mktemp -d "${TMPDIR:-/tmp}/recap-update.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT

zip_url=$(printf '%s\n' "$body" | sed -n 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"\([^"]*recap-chrome-mv3\.zip\)".*/\1/p' | sed -n '1p')
if [[ -z $zip_url ]]; then
  log "release $latest has no recap-chrome-mv3.zip"
  exit 1
fi

curl -fsSL -H "User-Agent: recap-update" -o "$tmp/recap.zip" "$zip_url" || {
  log "download failed for $latest"
  exit 1
}

unzip -q "$tmp/recap.zip" -d "$tmp/stage"
if [[ ! -f $tmp/stage/manifest.json ]]; then
  log "zip for $latest has no manifest.json; left the installed copy in place"
  exit 1
fi

mkdir -p -- "$home/Tools" "$(dirname -- "$dest")"
backup=$home/Tools/recap.bak.$(date +%Y%m%d%H%M%S)
if [[ -e $dest ]]; then
  mv -- "$dest" "$backup"
fi
if ! mv -- "$tmp/stage" "$dest"; then
  if [[ -e $backup && ! -e $dest ]]; then
    mv -- "$backup" "$dest"
  fi
  log "could not swap in $latest"
  exit 1
fi

prune_backups
log "installed $latest"
notify "$latest"
