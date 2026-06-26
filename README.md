# DevTrace for GitHub

[![CI](https://github.com/thingzio/devtrace-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/thingzio/devtrace-extension/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A Chrome extension that shows [DevTrace](https://devtrace.thingz.io) contributor trust scores inline on GitHub.** It adds a small DevTrace badge next to GitHub usernames; click it to see a trust score, grade, and risk summary — the same signals the [DevTrace GitHub Action](https://github.com/thingzio/devtrace-action) posts on pull requests.

## What it does

- Injects a DevTrace gauge badge next to contributor links on `github.com`.
- Click the badge to open a score card: letter grade, score (0.00–1.00), and risk summary.
- "Full review →" links to `https://devtrace.thingz.io/score/<username>` for the complete breakdown.
- Works anonymously out of the box. Add an optional API token for deeper scoring (profile, signals, AI sensing, repo context).

## Install

### From the Chrome Web Store

_Listing link TBD._

### From source (developer / load unpacked)

```bash
npm ci
npm run build      # outputs a loadable extension to dist/
```

Then in Chrome: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist/` folder.

## Token (optional)

Without a token you get the basic score. For deeper scoring, create an API token (`dt_` prefix) at [devtrace.thingz.io/settings](https://devtrace.thingz.io/settings), then open the extension's options page and paste it in.

## Privacy

- The token is stored locally in your browser via `chrome.storage.sync`; it is never sent anywhere except DevTrace.
- Only the username you click (and the current `owner/repo` for context) is sent to `https://devtrace.thingz.io`. No browsing history or page content is collected.
- The extension requests only the `storage` permission and host access to `https://devtrace.thingz.io/*`.
- Score data is fetched by the background service worker and rendered inside an isolated Shadow DOM using `textContent` (never `innerHTML` for dynamic values), so API responses cannot inject markup into GitHub pages.

## How it works

```
content script (github.com)  ──click──▶  background service worker  ──HTTPS──▶  devtrace.thingz.io
   scans usernames,                          holds optional token,                /api/v1/score/{user}
   injects badge,                            5-min cache,
   renders Shadow-DOM card  ◀──result──      bypasses CORS via host_permissions
```

## Development

```bash
npm test          # jest + jsdom unit tests
npm run lint      # tsc --noEmit
npm run build     # bundle to dist/ via esbuild
npm run icons     # regenerate PNG icons from the gauge mark (requires sharp)
```

The build is reproducible: `npm ci && npm run build` from a clean checkout produces the published `dist/`. Icons are committed under `public/icons/` and generated deterministically from `public/icons/devtrace.svg` by `scripts/gen-icons.mjs`.

Tagging a release (`vX.Y.Z`) builds and attaches `devtrace-extension.zip` to a GitHub Release for Web Store upload.

## Publishing to the Chrome Web Store

1. Build `dist/` and zip it (or download the `devtrace-extension.zip` Release artifact).
2. Create a [Chrome Web Store developer account](https://chrome.google.com/webstore/devconsole) (one-time $5 fee).
3. Upload the zip and complete the listing: description, screenshots, and privacy practices — declare the `storage` permission and host access to `https://devtrace.thingz.io`.
4. Justify permissions: `storage` (token persistence) and the single host permission (score API).
5. Submit for review and link this public repository.

## License

MIT — see [LICENSE](LICENSE).
