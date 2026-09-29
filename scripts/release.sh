#!/usr/bin/env bash
# Prepares a release: bumps the version, checks that everything builds, and prints the tag
# commands. Pushing the tag makes .github/workflows/release.yml build and publish it.
# Usage: scripts/release.sh <version>   e.g. scripts/release.sh 0.2.0
set -euo pipefail

cd "$(dirname "$0")/.."

version="${1:-}"
version="${version#v}"
if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Usage: scripts/release.sh <version>   (e.g. 0.2.0)" >&2
  exit 1
fi

current="$(node -p "require('./package.json').version")"
if [[ "$current" != "$version" ]]; then
  npm version "$version" --no-git-tag-version >/dev/null
  echo "Version bumped: $current -> $version"
fi

npm ci
scripts/package.sh

cat <<SUMMARY

Local build OK. To publish v$version:

  git add package.json package-lock.json
  git commit -m "chore: release v$version"
  git tag v$version
  git push origin main v$version

GitHub Actions then builds the DMG, creates the release and updates the Homebrew tap.
SUMMARY
