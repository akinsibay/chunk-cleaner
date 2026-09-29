# ChunkCleaner

[![CI](https://github.com/akinsibay/chunk-cleaner/actions/workflows/ci.yml/badge.svg)](https://github.com/akinsibay/chunk-cleaner/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/akinsibay/chunk-cleaner)](https://github.com/akinsibay/chunk-cleaner/releases/latest)
![macOS 13+](https://img.shields.io/badge/macOS-13%2B-lightgrey)
![Apple Silicon](https://img.shields.io/badge/Apple%20Silicon-arm64-8b5cf6)

A small Mac app that finds the big, regenerable folders your projects leave behind — `node_modules`, Rust and Maven `target`, Python virtualenvs, Unity `Library`, `Pods`, `.next`, Gradle `build` — and moves them to the Trash in a few clicks.

It only lists folders it can prove belong to a project, and it only ever moves them to the Trash, so everything can be restored.

<!-- Screenshot placeholder: add docs/images/screenshot.png and replace this comment with
![ChunkCleaner showing reclaimable node_modules and target folders](docs/images/screenshot.png) -->

## Install

**Requirements:** macOS 13 (Ventura) or later on an Apple Silicon Mac (M1 or newer). Intel Macs are not supported.

1. Download `ChunkCleaner-<version>-arm64.dmg` from the [latest release](https://github.com/akinsibay/chunk-cleaner/releases/latest).
2. Open it and drag **ChunkCleaner** into **Applications**.
3. Follow [First launch](#first-launch-unsigned-app) once.

<details>
<summary>Verify the download (optional)</summary>

Each release has a `.sha256` file next to the DMG:

```sh
shasum -a 256 -c ChunkCleaner-<version>-arm64.dmg.sha256
```

</details>

## First launch (unsigned app)

ChunkCleaner is free and open source, and I don't pay for an Apple Developer account, so the app isn't signed by Apple. macOS therefore blocks it the first time and says it "cannot verify" the app. That's expected — here's how to open it once; after that it opens normally.

**macOS Sequoia (15) and later:**

1. Double-click ChunkCleaner in Applications. macOS shows a warning — click **Done**.
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the message about ChunkCleaner and click **Open Anyway**.
4. Confirm with your password or Touch ID, then click **Open Anyway** again.

**macOS Ventura (13) and Sonoma (14):** right-click ChunkCleaner in Applications, choose **Open**, then click **Open** in the dialog.

**Prefer the terminal?** This removes the quarantine flag macOS added when you downloaded the app:

```sh
xattr -dr com.apple.quarantine /Applications/ChunkCleaner.app
```

## Usage

1. Click **Choose Folder…** (or type a path such as `~/Projects`) and press the big **Scan** button. You can cancel at any time.
2. Review the list. Sort by any column; right-click a row for **Show in Finder**.
3. Tick the folders you want gone and click **Move to Trash**. You'll see how many folders and how much space before anything happens.

Closing the window keeps ChunkCleaner in the menu bar, where it shows your last scan. Quit with **⌘Q** or from the menu bar icon.

### What gets detected

A folder is only listed when its name **and** its marker file match. A `target` folder without a `Cargo.toml` or `pom.xml` next to it is ignored.

| Folder | Ecosystem | Required marker |
|---|---|---|
| `node_modules` | Node.js | `package.json` next to it |
| `target` | Rust / Maven | `Cargo.toml` or `pom.xml` next to it |
| `.venv`, `venv` | Python | `pyvenv.cfg` inside it |
| `Library` | Unity | `ProjectSettings/` next to it |
| `Pods` | CocoaPods | `Podfile` next to it |
| `.next` | Next.js | `next.config.*` or `package.json` next to it |
| `build` | Gradle | `build.gradle` or `build.gradle.kts` next to it |

### Settings

Click **Settings** in the sidebar:

- **Minimum folder size** (default 200 MB): smaller folders are not listed.
- **Project age** (default 30 days): only projects with no changes in that time are listed. "Last activity" is the newest change anywhere in the project, ignoring the dependency folders themselves and `.git`. Tick **Include recently used projects** to list everything.
- **Open at login**: starts ChunkCleaner quietly in the menu bar when you log in. macOS may ask you to allow it in System Settings → General → Login Items.
- **Check for updates automatically**: see [Updates](#updates).

## Full Disk Access

macOS protects some folders (Desktop, Documents, Downloads, iCloud Drive and others). If ChunkCleaner can't read something, it skips it and tells you how many folders were skipped — it never fails the scan. macOS may also ask for permission the first time you scan one of these folders.

To let it read everything:

1. Open **System Settings → Privacy & Security → Full Disk Access**.
   <!-- Screenshot placeholder: docs/images/full-disk-access-1.png -->
2. Turn on **ChunkCleaner**. If it isn't listed, click **+** and add it from Applications.
   <!-- Screenshot placeholder: docs/images/full-disk-access-2.png -->
3. Quit and reopen ChunkCleaner.

Because the app is not signed with an Apple Developer ID, macOS may forget this permission after you install a new version. If folders show up as unreadable after an update, turn the switch off and on again.

## Updates

ChunkCleaner can't update itself (that requires an Apple-signed app). Once a day it asks GitHub whether a newer release exists and, if so, shows a banner with a **Download** button. You can also use **Check for Updates…** in the app or menu bar menu. Turn this off in Settings if you prefer.

To update, download the new DMG and replace the app in Applications.

## Uninstall

1. Quit ChunkCleaner (⌘Q or the menu bar icon → Quit).
2. Drag **ChunkCleaner** from Applications to the Trash.
3. Optionally delete its settings: `~/Library/Application Support/ChunkCleaner`.

If you enabled **Open at login**, turn it off in Settings first, or remove ChunkCleaner in System Settings → General → Login Items afterwards.

## Build from source

Requires Node.js 22.12 or later. No Xcode needed.

```sh
git clone https://github.com/akinsibay/chunk-cleaner.git
cd chunk-cleaner
npm ci
npm start            # builds and runs the app
npm run dist         # builds release/ChunkCleaner-<version>-arm64.dmg
```

Apps you build yourself aren't quarantined, so macOS won't show the unsigned-app warning. Run the tests with `npm test` and the type checks with `npm run typecheck`.

## Why it's safe

- **Trash only.** Folders are moved with macOS's own Trash API, the same as dragging them to the Trash in Finder. There is no permanent-delete option anywhere in the code.
- **Proven matches only.** A folder is listed only when its marker file exists, and each folder is checked again right before it's moved: it must still exist, still have its marker, not be a symbolic link, and still be inside the folder you scanned. Nothing outside those folders is touched — not lock files, not source code.
- **Careful scanning.** Symbolic links are never followed or counted. ChunkCleaner doesn't look inside matched folders or `.git`, skips `~/Library`, `~/.npm`, `~/.cargo`, `~/.gradle`, `~/.m2`, `~/.nuget`, `~/.cache`, `~/.Trash`, `/System` and `/Applications`, and refuses to scan `/` or your whole home folder.
- **Locked-down app.** The interface runs sandboxed without Node.js access and can only ask the app to act on items from the last scan — never on arbitrary paths.
- **Almost no network.** The only request is the optional daily update check to GitHub's releases API. Nothing about your files ever leaves your Mac.
- **Open source and verifiable.** All code is in this repository, and every release has a SHA256 checksum.

## Contributing

Bug reports, new ecosystem rules and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
