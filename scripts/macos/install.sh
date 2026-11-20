#!/bin/bash
# Cài Recap vào $HOME/Tools/recap. Chạy được qua pipe:
#   curl -fsSL https://raw.githubusercontent.com/tungdd97/recap/main/scripts/macos/install.sh | bash
# Không đọc và không ghi profile Chrome.
set -euo pipefail

home=$(cd -- "$HOME" && pwd -P)
dest=$home/Tools/recap
tools=$home/Tools
raw_base=https://raw.githubusercontent.com/tungdd97/recap/main/scripts/macos
zip_url=https://github.com/tungdd97/recap/releases/latest/download/recap-chrome-mv3.zip
version_url=https://github.com/tungdd97/recap/releases/latest/download/version.json

die() {
  printf '%s\n' "$*" >&2
  exit 1
}

json_version() {
  local file=$1 line
  line=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file")
  printf '%s\n' "$line" | sed -n '1p'
}

install_updater=1
for arg in "$@"; do
  case $arg in
    --no-updater) install_updater=0 ;;
    -h | --help)
      printf '%s\n' "Cách dùng: install.sh [--no-updater]"
      printf '%s\n' "  curl -fsSL https://raw.githubusercontent.com/tungdd97/recap/main/scripts/macos/install.sh | bash"
      printf '%s\n' "  curl -fsSL https://raw.githubusercontent.com/tungdd97/recap/main/scripts/macos/install.sh | bash -s -- --no-updater"
      exit 0
      ;;
    *)
      die "Không hiểu tham số: $arg. Cách dùng: install.sh [--no-updater]"
      ;;
  esac
done

tmp=$(mktemp -d "${TMPDIR:-/tmp}/recap-install.XXXXXX")
trap 'rm -rf -- "$tmp"' EXIT

curl -fsSL -H "User-Agent: recap-install" -o "$tmp/recap.zip" "$zip_url" || die "Không tải được recap-chrome-mv3.zip"
curl -fsSL -H "User-Agent: recap-install" -o "$tmp/version.json" "$version_url" || die "Không tải được version.json"

unzip -tq "$tmp/recap.zip" >/dev/null || die "File zip không hợp lệ"
mkdir -p -- "$tmp/stage"
unzip -q "$tmp/recap.zip" -d "$tmp/stage"
if [[ ! -f $tmp/stage/manifest.json ]]; then
  die "Zip không có manifest.json ở thư mục gốc. Bản đã cài (nếu có) được giữ nguyên."
fi

release_version=$(json_version "$tmp/version.json")
manifest_version=$(json_version "$tmp/stage/manifest.json")
if [[ -z $release_version || $release_version != "$manifest_version" ]]; then
  die "version.json ($release_version) không khớp manifest.json ($manifest_version)"
fi
cp -- "$tmp/version.json" "$tmp/stage/version.json"

mkdir -p -- "$tools"
backup=
if [[ -e $dest ]]; then
  backup=$tools/recap.bak.$(date +%Y%m%d%H%M%S)
  if [[ -e $backup ]]; then
    backup=${backup}.$$
  fi
  mv -- "$dest" "$backup"
  printf 'Đã sao lưu bản cũ vào %s\n' "$backup"
fi
if ! mv -- "$tmp/stage" "$dest"; then
  if [[ -n $backup && -e $backup && ! -e $dest ]]; then
    mv -- "$backup" "$dest"
  fi
  die "Không cài được vào $dest"
fi

printf '\nĐã cài Recap %s vào %s\n\n' "$manifest_version" "$dest"
printf '%s\n' "Bước tiếp theo, trên Chrome của bạn:"
printf '%s\n' "1. Mở chrome://extensions"
printf '%s\n' "2. Bật Developer mode (Chế độ nhà phát triển)"
printf '%s\n' "3. Chọn Load unpacked và trỏ tới thư mục:"
printf '   %s\n' "$dest"
printf '%s\n' "   Nếu đã nạp đúng thư mục này rồi, chỉ cần bấm Reload."
printf '%s\n' "4. Đăng nhập bằng tài khoản ChatGPT hoặc khóa OpenRouter của chính bạn."
printf '%s\n' "   Mỗi người dùng tài khoản riêng. Lệnh này không đụng tới profile Chrome."

if ((install_updater == 0)); then
  printf '\n%s\n' "Bỏ qua lịch cập nhật (--no-updater)."
  exit 0
fi

script_path=${BASH_SOURCE[0]:-}
script_dir=
if [[ -n $script_path && -f $script_path ]]; then
  script_dir=$(cd -- "$(dirname -- "$script_path")" && pwd)
fi
if [[ -z $script_dir || ! -f $script_dir/install-updater.sh || ! -f $script_dir/recap-update.sh ]]; then
  script_dir=$tmp/macos
  mkdir -p -- "$script_dir"
  curl -fsSL -H "User-Agent: recap-install" -o "$script_dir/recap-update.sh" "$raw_base/recap-update.sh" || die "Không tải được recap-update.sh"
  curl -fsSL -H "User-Agent: recap-install" -o "$script_dir/install-updater.sh" "$raw_base/install-updater.sh" || die "Không tải được install-updater.sh"
  chmod +x "$script_dir/recap-update.sh" "$script_dir/install-updater.sh"
fi

printf '\n%s\n' "Đang cài lịch cập nhật mỗi ngày lúc 08:00..."
bash "$script_dir/install-updater.sh"
