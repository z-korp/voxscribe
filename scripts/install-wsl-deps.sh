#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${WSL_DISTRO_NAME:-}" ]]; then
  echo "This installer is intended for WSL environments." >&2
fi

packages=(
  libasound2t64
  mesa-utils
)

echo "Updating package index..."
sudo apt update

echo "Installing packages: ${packages[*]}"
sudo apt install -y "${packages[@]}"

echo "Done. Restart your WSL shell before running Electron."
