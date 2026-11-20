#!/bin/bash
# Remove the LaunchAgent and the recap-update command. Leaves the extension in place.
set -euo pipefail

home=$(cd -- "$HOME" && pwd -P)
label=com.tungdd97.recap-update
plist=$home/Library/LaunchAgents/$label.plist
domain=gui/$(id -u)

launchctl bootout "$domain/$label" >/dev/null 2>&1 || true
rm -f -- "$plist" "$home/Tools/bin/recap-update"
echo "removed the updater. $home/Tools/recap was left in place"
