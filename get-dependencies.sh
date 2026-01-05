#!/usr/bin/env bash
# Download dependencies for all Canton apps
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "Downloading dependencies for all apps"
echo "========================================"

# Lunar Dollar
echo ""
echo ">>> lunar-dollar"
cd "$SCRIPT_DIR/lunar-dollar"
./get-dependencies.sh

# Vault
echo ""
echo ">>> vault"
cd "$SCRIPT_DIR/vault"
./get-dependencies.sh

echo ""
echo "========================================"
echo "All dependencies downloaded successfully!"
echo "========================================"

