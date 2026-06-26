# DevTrace Browser Extension — Design

Date: 2026-06-26
Status: Approved

## Goal

A Chrome extension (Manifest V3) that recognizes GitHub contributors on
`github.com`, injects a small DevTrace badge next to them, and on click shows a
trust-score card. Mirrors the contract used by the `thingzio/devtrace-action`
GitHub Action. Supports an optional `dt_` API token for deeper scoring and links
to `https://devtrace.thingz.io/score/<username>` for the full review.

Repo: `github.com/thingzio/devtrace-extension` (public, for reviewability).

## API contract (reused from the action)

`GET https://devtrace.thingz.io/api/v1/score/{username}`
- Optional `Authorization: Bearer <dt_ token>` header.
- Optional query params: `repo=owner/repo`, `trusted_orgs=...`.
- 30s timeout.

Verified behavior:
- **No token → HTTP 200** with basic `score.grade`, `score.value`, and a
  `detail` prompting signup. Token is therefore genuinely optional.
- **With token →** adds `profile`, `signals`, `repo_context`, `ai_sensing`, etc.

`ScoreResponse` type is lifted verbatim from the action's `src/api.ts`.

## Architecture (MV3)

```
Content script (github.com)
  • Scans DOM for @username links + avatars
  • Injects DevTrace badge next to each (idempotent)
  • On badge click → chrome.runtime.sendMessage
  • Renders score card in Shadow DOM
  • Re-scans on GitHub PJAX/Turbo navigation
        │ sendMessage {type:'SCORE', username, repo}
        ▼
Service worker (background)
  • Reads token from chrome.storage.sync
  • fetch GET /api/v1/score/{user} (+ ?repo= from sender tab URL)
  • In-memory LRU cache, TTL ~5 min, to dedupe repeat clicks
  • Returns ScoreResponse or structured error
Options page
  • Paste / validate / clear dt_ token → chrome.storage.sync
```

- `host_permissions`: `https://devtrace.thingz.io/*` (lets the worker bypass CORS).
- `content_scripts` match: `https://github.com/*`.
- `permissions`: `storage` only.
- No remote code (Chrome Web Store policy compliant); all logic bundled.

## Repo layout

```
devtrace-extension/
  manifest.json
  src/
    content.ts      # DOM scan, badge inject, card render, SPA nav hook
    background.ts   # message handler, fetch, cache, token read
    options.ts      # token settings page logic
    api.ts          # buildURL + fetchScore (ported from action src/api.ts)
    card.ts         # Shadow-DOM card markup/styles from ScoreResponse
    types.ts        # ScoreResponse (shared contract with action)
  public/           # options.html, icons/
  __tests__/        # jest + jsdom
  dist/             # built bundle (esbuild/tsup)
```

## Data flow (badge click)

1. Click badge for `@alice` → content script sends
   `{type:'SCORE', username:'alice', repo:'owner/repo'}`.
2. Worker checks cache → else fetches with `Authorization: Bearer <token>`
   (header omitted entirely if no token).
3. Returns `ScoreResponse`; content script renders card:
   grade chip, score `0.00–1.00`, `risk_summary`, a few key signals
   (account age, followers, verified commits), and **"Full review →"**
   linking to `https://devtrace.thingz.io/score/alice`.
4. No token → card shows basic grade/score + the `detail` line and a subtle
   "Add a token for deeper scoring" hint linking to the options page.

## Error handling

- **401/403** → "Invalid or missing token" + link to options.
- **404** → "No DevTrace profile for @user."
- **429** → "Rate limited, try again shortly" (cache shields repeat clicks).
- **Network/timeout (30s)** → "Couldn't reach DevTrace."
- DOM scanning is defensive: failures never break GitHub's page; badges skip
  already-tagged nodes.

## Testing & release

- **Unit (jest + jsdom):** `api.ts` URL building + auth header; card rendering
  from fixture `ScoreResponse`; message routing.
- **Manual:** load unpacked on PR / issue / profile pages.
- **CI (GitHub Actions):** lint, test, build, zip artifact; tag → attach
  `dist.zip` to a Release.
- **Publish:** manual upload to Chrome Web Store for v1; CWS API automation is a
  later optional step. README documents the build so reviewers reproduce `dist/`.

## Open questions

1. **Badge placement scope** — start with @mentions in comments/PR/issues +
   profile headers; expand to commit author lines / contributors list later.
2. **Branding** — reuse the action's shield/blue icon, or new artwork?
3. **Firefox/Edge** — MV3 is largely portable; out of scope for v1 but the
   `devtrace-extension` name leaves room.
