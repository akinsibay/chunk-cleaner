# Releasing ChunkCleaner

Releases are built by GitHub Actions when a `v*` tag is pushed. You prepare the version locally; CI builds the DMG, publishes the GitHub Release and updates the Homebrew tap.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| [`ci.yml`](../.github/workflows/ci.yml) | Pull requests and pushes to `main` | Type checks, unit tests, build. |
| [`release.yml`](../.github/workflows/release.yml) | Pushing a `v*` tag | Checks the tag matches `package.json`, runs [`scripts/package.sh`](../scripts/package.sh) (tests, universal ad-hoc signed DMG, `lipo`/`codesign` checks, SHA256, cask), publishes the GitHub Release with generated notes, and pushes the cask to the tap. |

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

## One-time setup: Homebrew tap

The release workflow updates the tap only when the `TAP_GITHUB_TOKEN` secret exists; otherwise it skips that step with a notice.

1. **Create the tap repository.** Homebrew only recognises repositories named `homebrew-<name>`: create a public repository **`akinsibay/homebrew-tap`** on GitHub. It can start empty; the workflow creates `Casks/chunkcleaner.rb`.
2. **Create a token.** GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → *Generate new token*:
   - Repository access: *Only select repositories* → `akinsibay/homebrew-tap`
   - Permissions → Repository permissions → **Contents: Read and write**
   - Pick an expiry and note the date; the tap step fails once it expires.
3. **Add it as a secret.** In `akinsibay/chunk-cleaner`: Settings → Secrets and variables → Actions → *New repository secret*, name **`TAP_GITHUB_TOKEN`**, value = the token.

Users then install with `brew install --cask akinsibay/tap/chunkcleaner`. The cask clears the quarantine flag in `postflight`, so Homebrew users don't see the Gatekeeper warning. Homebrew's own `homebrew/cask` repository does not accept unsigned apps, which is why a personal tap is used.

If the tap update ever fails (for example an expired token), the GitHub Release is already published. Re-run just that job after fixing the secret, or copy the cask by hand: download the DMG's `.sha256`, fill in `packaging/homebrew/chunkcleaner.rb`, and push it to the tap.

## Checklist

- [ ] Version bumped and committed, tag `v<version>` pushed
- [ ] Release workflow green; log shows `Verified: x86_64 arm64, Signature=adhoc`
- [ ] Release page has the `.dmg` and `.dmg.sha256`
- [ ] Downloaded DMG opens after "Open Anyway" on a Mac that hasn't run ChunkCleaner before
- [ ] `brew update && brew upgrade --cask chunkcleaner` installs the new version
