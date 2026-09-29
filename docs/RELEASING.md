# Releasing ChunkCleaner

Releases are built by GitHub Actions when a `v*` tag is pushed. You prepare the version locally; CI builds the DMG and publishes the GitHub Release.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Pull requests and pushes to `main` | Type checks, unit tests, build. |
| [`release.yml`](../.github/workflows/release.yml) | Pushing a `v*` tag | Checks the tag matches `package.json`, runs [`scripts/package.sh`](../scripts/package.sh) (tests, universal ad-hoc signed DMG, `lipo`/`codesign` checks, SHA256) and publishes the GitHub Release with generated notes. |

## Cutting a release

1. Prepare the version and make sure it builds locally (optional but recommended):

   ```sh
   scripts/release.sh 0.2.0
   ```

   This bumps `package.json`/`package-lock.json`, runs `npm ci` and the same `scripts/package.sh` CI uses. If you only want the version bump: `npm version 0.2.0 --no-git-tag-version`.

2. Commit, tag and push:

   ```sh
   git add package.json package-lock.json
   git commit -m "chore: release v0.2.0"
   git tag v0.2.0
   git push origin main v0.2.0
   ```

3. Watch the **Release** workflow in the Actions tab (about 10 minutes). When it finishes, the release page has:
   - `ChunkCleaner-0.2.0-universal.dmg`
   - `ChunkCleaner-0.2.0-universal.dmg.sha256`
   - release notes generated from the merged pull requests and commits

   Edit the notes afterwards if you want to highlight something.

If the tag and `package.json` disagree, the workflow stops before building. Fix it by deleting the tag (`git tag -d v0.2.0 && git push origin :refs/tags/v0.2.0`), correcting the version, and tagging again.

## Checklist

- [ ] Version bumped and committed, tag `v<version>` pushed
- [ ] Release workflow green; log shows `Verified: x86_64 arm64, Signature=adhoc`
- [ ] Release page has the `.dmg` and `.dmg.sha256`
- [ ] Downloaded DMG opens after "Open Anyway" on a Mac that hasn't run ChunkCleaner before
