# Contributing to ChunkCleaner

Thanks for helping out! Bug reports, new ecosystem rules and pull requests are all welcome.

## Development setup

You need macOS 13+ and Node.js 22.12+. No Xcode needed.

```sh
npm ci
npm start           # builds everything and opens the app
npm test            # unit tests (Vitest)
npm run typecheck   # TypeScript, main process and UI
npm run dist        # universal DMG in release/
```

If `npm start` behaves like plain Node (for example `app` is undefined), your shell has `ELECTRON_RUN_AS_NODE` set; run `unset ELECTRON_RUN_AS_NODE` first.

## Project layout

| Path | What lives there |
|---|---|
| `src/core/` | Scanning, size and activity calculation, re-validation and trashing. No Electron or UI code; everything here is unit tested. |
| `src/main/` | The Electron main process: window, menu bar icon, IPC, settings and the update check. `ipcHandlers.ts` holds all IPC behaviour without Electron so it can be tested. |
| `src/main/preload.ts` | Exposes the typed `window.chunkcleaner` API to the UI. |
| `src/shared/` | Types and helpers shared by the main process and the UI. |
| `web/` | The React interface (Vite, CSS Modules). It has no Node.js access. |
| `test/` | Vitest tests. They build real folder trees in temporary directories. |
| `build/` | App icon sources. Regenerate the PNGs with `npx electron scripts/render-icons.cjs`. |
| `packaging/homebrew/` | Cask template filled in by `scripts/package.sh`. |
| `.github/workflows/` | CI for pull requests and the tag-triggered release (see [docs/RELEASING.md](docs/RELEASING.md)). |

## Adding an ecosystem

Rules live in [`src/core/rules.ts`](src/core/rules.ts). Adding one is a single line:

```ts
{ folderNames: ['vendor'], ecosystem: 'Composer', marker: parentFile('composer.json') },
```

Only add a rule when the folder is **fully regenerable** from files that stay in the project (a lock file or manifest). Pick a marker that proves the match; a folder name alone is never enough. Add a case to `test/rules.test.ts` and update the table in the README.

## Safety rules

These are not up for debate in pull requests:

- Only move to the Trash; never delete permanently.
- Never follow symbolic links.
- Never touch anything outside a matched folder.
- Re-validate every item immediately before moving it.

Changes to `src/core/trasher.ts`, `src/core/scanner.ts` or `src/main/ipcHandlers.ts` need tests that show these rules still hold.

## Pull requests

- Keep changes focused; one topic per pull request.
- Make sure `npm run typecheck` and `npm test` pass; CI runs both on every pull request.
- Describe what changed and how you tested it.

## Security

Found a way to make ChunkCleaner touch files it shouldn't? Please open a private [security advisory](https://github.com/akinsibay/chunk-cleaner/security/advisories/new) instead of a public issue.
