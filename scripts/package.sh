#!/usr/bin/env bash
# Type-checks, tests and builds the universal DMG, then writes its SHA256 checksum into
# release/. Expects dependencies to be installed already (npm ci).
# Used by scripts/release.sh locally and by .github/workflows/release.yml in CI.
set -euo pipefail

cd "$(dirname "$0")/.."
# Some editors and tools export this, which makes Electron behave like plain Node.
unset ELECTRON_RUN_AS_NODE
export CSC_IDENTITY_AUTO_DISCOVERY=false

version="$(node -p "require('./package.json').version")"

# Make sure the Electron binary is present even if install scripts were skipped.
node node_modules/electron/install.js
npm run typecheck
npm test

rm -rf release
npm run dist

app="release/mac-universal/ChunkCleaner.app"
dmg_name="ChunkCleaner-$version-universal.dmg"

archs="$(lipo -archs "$app/Contents/MacOS/ChunkCleaner")"
if [[ "$archs" != *x86_64* || "$archs" != *arm64* ]]; then
  echo "Expected a universal binary, got: $archs" >&2
  exit 1
fi
signature="$(codesign -dv "$app" 2>&1 | grep '^Signature=' || true)"
if [[ "$signature" != "Signature=adhoc" ]]; then
  echo "Expected an ad-hoc signature, got: ${signature:-none}" >&2
  exit 1
fi
codesign --verify --deep --strict "$app"

(cd release && shasum -a 256 "$dmg_name" > "$dmg_name.sha256")
sha="$(cut -d ' ' -f 1 "release/$dmg_name.sha256")"

echo "Verified: $archs, $signature"
echo "Built release/$dmg_name ($sha)"
