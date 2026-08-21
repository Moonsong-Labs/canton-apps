#!/usr/bin/env bash
# Download Daml Finance dependencies for rwa-grains
# SPDX-License-Identifier: Apache-2.0

set -euo pipefail

# Create .lib directory
if [[ -d .lib ]]; then
  rm -r .lib
fi
mkdir .lib

# Get the dependency list (hardcoded version)
echo "Downloading the list of dependencies"
version="0.0.6"
curl -L# \
  -H 'Cache-Control: no-cache, no-store' \
  -o .lib/${version}.conf \
  https://raw.githubusercontent.com/digital-asset/daml-finance/main/docs/code-samples/tutorials-config/${version}.conf

# For each dependency, download and install
while IFS=" " read -r url out
do
  printf "Downloading: %s, to: %s\n" "$url" "$out"
  curl -Lf# "${url}" -o ${out}
done < .lib/${version}.conf

echo "All dependencies successfully downloaded!"
