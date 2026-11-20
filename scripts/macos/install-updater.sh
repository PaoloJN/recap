#!/bin/bash
# Copy recap-update into $HOME/Tools/bin and load a daily 08:00 LaunchAgent.
set -euo pipefail

home=$(cd -- "$HOME" && pwd -P)
script_dir=$(cd -- "$(dirname -- "$0")" && pwd)
bin_dir=$home/Tools/bin
agent_dir=$home/Library/LaunchAgents
label=com.tungdd97.recap-update
plist=$agent_dir/$label.plist
target=$bin_dir/recap-update
domain=gui/$(id -u)

mkdir -p -- "$bin_dir" "$agent_dir" "$home/Library/Logs"
cp -- "$script_dir/recap-update.sh" "$target"
chmod +x "$target"

cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$label</string>
  <key>ProgramArguments</key>
  <array>
    <string>$target</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>8</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>RunAtLoad</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$home/Library/Logs/recap-update.log</string>
  <key>StandardErrorPath</key>
  <string>$home/Library/Logs/recap-update.log</string>
</dict>
</plist>
EOF

launchctl bootout "$domain/$label" >/dev/null 2>&1 || true
launchctl bootstrap "$domain" "$plist"
echo "recap-update runs daily at 08:00 ($plist)"
