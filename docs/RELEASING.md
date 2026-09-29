# Releasing ChunkCleaner

Releases are built by GitHub Actions when a `v*` tag is pushed. You prepare the version locally; CI builds the DMG and publishes the GitHub Release.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Pull requests and pushes to `main` | Type checks, unit tests, build. |
| [`release.yml`](../.github/workflows/release.yml) | Pushing a `v*` tag | Checks the tag matches `package.json`, runs [`scripts/package.sh`](../scripts/package.sh) (tests, Apple Silicon ad-hoc signed DMG, `lipo`/`codesign` checks, SHA256) and publishes the GitHub Release with generated notes. |

## Cutting a release

1. Commit everything you want in the release; `npm version` refuses to run on a dirty working tree.

2. Run the script for the kind of release:

   | Command | Example | Use for |
   |---|---|---|
   | `npm run release:patch` | 0.1.0 → 0.1.1 | Bug fixes and small changes |
   | `npm run release:minor` | 0.1.0 → 0.2.0 | New features |
   | `npm run release:major` | 0.1.0 → 1.0.0 | Big or incompatible changes |

   Each one runs `npm version <kind> -m "chore: release v%s"`, which updates `package.json` and `package-lock.json`, commits them and creates the `v<version>` tag, then `git push --follow-tags`, which pushes `main` and the tag together.

   To try the full release build on your Mac first, run `scripts/package.sh` (after `npm ci`); it is the same script CI runs.

3. Watch the **Release** workflow in the Actions tab (about 10 minutes). When it finishes, the release page has:
   - `ChunkCleaner-0.1.1-arm64.dmg`
   - `ChunkCleaner-0.1.1-arm64.dmg.sha256`
   - release notes generated from the merged pull requests and commits

   Edit the notes afterwards if you want to highlight something.

If the tag and `package.json` disagree, the workflow stops before building. This only happens when a tag is created by hand; the `release:*` scripts always keep them in sync. Fix it by deleting the tag (`git tag -d v0.1.1 && git push origin :refs/tags/v0.1.1`), correcting the version, and tagging again.

## Checklist

- [ ] Version bumped and committed, tag `v<version>` pushed
- [ ] Release workflow green; log shows `Verified: arm64, Signature=adhoc`
- [ ] Release page has the `.dmg` and `.dmg.sha256`
- [ ] Downloaded DMG opens after "Open Anyway" on a Mac that hasn't run ChunkCleaner before
