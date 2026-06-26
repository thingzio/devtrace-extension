# DevTrace Browser Extension Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A Manifest V3 Chrome extension that injects a DevTrace badge next to GitHub contributors and, on click, shows a trust-score card backed by the DevTrace API.

**Architecture:** A content script scans `github.com` pages for `@username` links/avatars and injects an idempotent badge. Clicking the badge messages a background service worker, which holds the optional `dt_` token, calls `GET https://devtrace.thingz.io/api/v1/score/{user}` (bypassing CORS via `host_permissions`), caches results, and returns a `ScoreResponse`. The content script renders the card in a Shadow DOM. An options page manages the token in `chrome.storage.sync`.

**Tech Stack:** TypeScript, esbuild (bundler), Jest + jsdom (tests), Chrome Manifest V3, GitHub Actions (CI).

**Reference:** Design doc `docs/plans/2026-06-26-devtrace-extension-design.md`. API contract and `ScoreResponse` are reused from `thingzio/devtrace-action` (`src/api.ts`).

---

## Branding (aligned to thingz.io)

The card, badge, and icons must match the thingz.io design language (dark theme).
Source: `https://thingz.io/colors_and_type.css` and the DevTrace product mark
`https://thingz.io/img/devtrace.svg`.

**Palette (CSS custom properties to use verbatim in `card.ts`):**

```
--dt-bg:        #0a0a0c   /* card surface */
--dt-bg-elev:   #171a22   /* elevated rows */
--dt-border:    #242836
--dt-accent:    #4a9eff   /* links, focus, brand */
--dt-glow:      #4a9eff25
--dt-text:      #f0f0f0
--dt-text-muted:#999999
--dt-text-dim:  #555555
--dt-ok:        #22c55e   /* grades A* */
--dt-warn:      #eab308   /* grades B/C */
--dt-danger:    #ef4444   /* grades D/F */
--dt-radius:    12px
```

**DevTrace mark** (line-art gauge; reuse as badge glyph and icon base):

```svg
<svg viewBox="-4 0 32 32" fill="none" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M2 20A10 10 0 0 1 22 20"/><line x1="12" y1="20" x2="7" y2="9"/><circle cx="12" cy="20" r="2"/></svg>
```

(Original mark strokes in `#f0f0f0`; recolor stroke to `--dt-accent` `#4a9eff`
for the badge/icon foreground.) Save the original as `public/icons/devtrace.svg`.

Grade→color helper (used by card and badge): grade starting with `A` → `--dt-ok`;
`B`/`C` → `--dt-warn`; `D`/`F` → `--dt-danger`; else `--dt-text-muted`.

## Conventions

- TDD throughout: failing test → run (fail) → minimal impl → run (pass) → commit.
- Commit messages: Conventional Commits (`feat:`, `test:`, `chore:`, `ci:`, `docs:`).
- Commits are signed (`git commit -S`), no `Co-Authored-By`, no sign-off.
- Source in `src/`, tests in `__tests__/`, static assets in `public/`, build output in `dist/`.
- Run all tests with `npm test`; a single file with `npm test -- <file>`.

---

## Task 0: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `jest.config.js`, `.gitignore` (append), `build.mjs`

**Step 1: Initialize package.json**

Create `package.json`:

```json
{
  "name": "devtrace-extension",
  "version": "0.1.0",
  "private": true,
  "description": "Chrome extension that shows DevTrace contributor trust scores inline on GitHub.",
  "license": "MIT",
  "scripts": {
    "build": "node build.mjs",
    "test": "jest",
    "lint": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.270",
    "@types/jest": "^29.5.12",
    "esbuild": "^0.23.0",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "ts-jest": "^29.2.0",
    "typescript": "^5.5.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "jest", "node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "__tests__"]
}
```

**Step 3: Create jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.ts'],
}
```

**Step 4: Append build output + deps to .gitignore**

Add lines: `node_modules/` and `dist/`.

> Note: `dist/` is gitignored during development; the Release workflow builds and attaches it. README documents the reproducible build.

**Step 5: Create build.mjs (esbuild bundler)**

```js
import * as esbuild from 'esbuild'
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('dist', { recursive: true })

await esbuild.build({
  entryPoints: {
    content: 'src/content.ts',
    background: 'src/background.ts',
    options: 'src/options.ts',
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  outdir: 'dist',
})

cpSync('public', 'dist', { recursive: true })
cpSync('manifest.json', 'dist/manifest.json')
console.log('build complete')
```

**Step 6: Install and verify**

Run: `npm install`
Run: `npm run lint` (no source yet → passes, no errors)

**Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js build.mjs .gitignore
git commit -S -m "chore: scaffold extension project (TS, esbuild, jest)"
```

---

## Task 1: Shared types (ScoreResponse)

**Files:**
- Create: `src/types.ts`

**Step 1: Port the ScoreResponse interface**

Copy the `ScoreResponse` interface verbatim from the action's `src/api.ts`
(version, username, provider, profile?, score{grade,value,categories?}, signals?,
risk_summary?, repo_context?, license?, ai_sensing?, behavior?, scoring_mode,
scored_at, cached_at?, detail?). Also add a message-protocol type:

```ts
export interface ScoreRequest {
  type: 'SCORE'
  username: string
  repo?: string
}

export type ScoreResult =
  | { ok: true; data: ScoreResponse }
  | { ok: false; status: number; message: string }
```

**Step 2: Verify it compiles**

Run: `npm run lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/types.ts
git commit -S -m "feat: add shared ScoreResponse and message types"
```

---

## Task 2: API client (buildURL + fetchScore)

**Files:**
- Create: `src/api.ts`
- Test: `__tests__/api.test.ts`

**Step 1: Write failing tests**

```ts
import { buildURL, fetchScore } from '../src/api'

describe('buildURL', () => {
  const base = 'https://devtrace.thingz.io'
  it('builds bare URL', () => {
    expect(buildURL('alice', { apiUrl: base })).toBe(
      'https://devtrace.thingz.io/api/v1/score/alice',
    )
  })
  it('appends repo param', () => {
    expect(buildURL('alice', { apiUrl: base, repo: 'o/r' })).toBe(
      'https://devtrace.thingz.io/api/v1/score/alice?repo=o%2Fr',
    )
  })
  it('encodes username', () => {
    expect(buildURL('a/b', { apiUrl: base })).toContain('score/a%2Fb')
  })
})

describe('fetchScore', () => {
  afterEach(() => jest.restoreAllMocks())

  it('omits Authorization header when no token', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ username: 'alice' }), { status: 200 }),
    )
    await fetchScore('alice', { apiUrl: 'https://x' })
    const headers = (f.mock.calls[0][1]!.headers) as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('sends Bearer token when provided', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ username: 'alice' }), { status: 200 }),
    )
    await fetchScore('alice', { apiUrl: 'https://x', token: 'dt_123' })
    const headers = (f.mock.calls[0][1]!.headers) as Record<string, string>
    expect(headers.Authorization).toBe('Bearer dt_123')
  })

  it('throws APIError on non-ok', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'nope' }), { status: 401 }),
    )
    await expect(fetchScore('alice', { apiUrl: 'https://x' })).rejects.toMatchObject({
      status: 401,
    })
  })
})
```

**Step 2: Run to verify fail**

Run: `npm test -- api.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement src/api.ts**

```ts
import type { ScoreResponse } from './types'

export interface FetchScoreOpts {
  apiUrl: string
  token?: string
  repo?: string
  trustedOrgs?: string
}

export class APIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(`DevTrace API error ${status}: ${message}`)
    this.name = 'APIError'
  }
}

export function buildURL(username: string, opts: FetchScoreOpts): string {
  const base = `${opts.apiUrl}/api/v1/score/${encodeURIComponent(username)}`
  const params = new URLSearchParams()
  if (opts.repo) params.set('repo', opts.repo)
  if (opts.trustedOrgs) {
    for (const org of opts.trustedOrgs.split(',')) {
      const t = org.trim()
      if (t) params.append('trusted_orgs', t)
    }
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export async function fetchScore(
  username: string,
  opts: FetchScoreOpts,
): Promise<ScoreResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  const resp = await fetch(buildURL(username, opts), {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(30_000),
  })

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new APIError(resp.status, (body as Record<string, string>).error ?? resp.statusText)
  }
  return (await resp.json()) as ScoreResponse
}
```

**Step 4: Run to verify pass**

Run: `npm test -- api.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/api.ts __tests__/api.test.ts
git commit -S -m "feat: add DevTrace API client with auth and URL building"
```

---

## Task 3: Background service worker (token, cache, routing)

**Files:**
- Create: `src/cache.ts`, `src/background.ts`
- Test: `__tests__/cache.test.ts`

**Step 1: Write failing test for cache**

```ts
import { TTLCache } from '../src/cache'

describe('TTLCache', () => {
  it('returns stored value before expiry', () => {
    let now = 1000
    const c = new TTLCache<number>(500, () => now)
    c.set('k', 42)
    now = 1400
    expect(c.get('k')).toBe(42)
  })
  it('expires after ttl', () => {
    let now = 1000
    const c = new TTLCache<number>(500, () => now)
    c.set('k', 42)
    now = 1600
    expect(c.get('k')).toBeUndefined()
  })
})
```

**Step 2: Run to verify fail**

Run: `npm test -- cache.test.ts`
Expected: FAIL

**Step 3: Implement src/cache.ts**

```ts
interface Entry<T> {
  value: T
  expires: number
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>()
  constructor(
    private ttlMs: number,
    private clock: () => number = () => Date.now(),
  ) {}

  get(key: string): T | undefined {
    const e = this.store.get(key)
    if (!e) return undefined
    if (this.clock() >= e.expires) {
      this.store.delete(key)
      return undefined
    }
    return e.value
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: this.clock() + this.ttlMs })
  }
}
```

**Step 4: Run to verify pass**

Run: `npm test -- cache.test.ts`
Expected: PASS

**Step 5: Implement src/background.ts (service worker)**

```ts
import { fetchScore, APIError } from './api'
import { TTLCache } from './cache'
import type { ScoreRequest, ScoreResult, ScoreResponse } from './types'

const API_URL = 'https://devtrace.thingz.io'
const cache = new TTLCache<ScoreResponse>(5 * 60 * 1000)

async function getToken(): Promise<string | undefined> {
  const { token } = await chrome.storage.sync.get('token')
  return typeof token === 'string' && token ? token : undefined
}

async function handle(req: ScoreRequest): Promise<ScoreResult> {
  const key = `${req.username}|${req.repo ?? ''}`
  const cached = cache.get(key)
  if (cached) return { ok: true, data: cached }

  try {
    const token = await getToken()
    const data = await fetchScore(req.username, { apiUrl: API_URL, token, repo: req.repo })
    cache.set(key, data)
    return { ok: true, data }
  } catch (err) {
    if (err instanceof APIError) return { ok: false, status: err.status, message: err.message }
    return { ok: false, status: 0, message: 'Network error' }
  }
}

chrome.runtime.onMessage.addListener((req: ScoreRequest, _sender, sendResponse) => {
  if (req?.type !== 'SCORE') return
  handle(req).then(sendResponse)
  return true // keep the message channel open for async response
})
```

> The async-listener `return true` contract cannot be unit-tested without a
> Chrome mock; it is covered by manual load-unpacked testing in Task 8.

**Step 6: Verify lint**

Run: `npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/cache.ts src/background.ts __tests__/cache.test.ts
git commit -S -m "feat: add background worker with TTL cache and message routing"
```

---

## Task 4: Score card rendering (Shadow DOM)

**Files:**
- Create: `src/card.ts`
- Test: `__tests__/card.test.ts`

**Step 1: Write failing tests**

```ts
import { renderCard, gradeColor } from '../src/card'
import type { ScoreResult } from '../src/types'

function host(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('gradeColor', () => {
  it('maps grade families to brand status colors', () => {
    expect(gradeColor('A+')).toBe('#22c55e')
    expect(gradeColor('B-')).toBe('#eab308')
    expect(gradeColor('C')).toBe('#eab308')
    expect(gradeColor('D')).toBe('#ef4444')
    expect(gradeColor('F')).toBe('#ef4444')
    expect(gradeColor('?')).toBe('#999999')
  })
})

describe('renderCard', () => {
  it('shows grade, value and full-review link on success', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'alice', score: { grade: 'B-', value: 0.67 } } as any,
    }
    const root = renderCard(host(), 'alice', res).shadowRoot!
    expect(root.textContent).toContain('B-')
    expect(root.textContent).toContain('0.67')
    const link = root.querySelector('a[href]') as HTMLAnchorElement
    expect(link.href).toBe('https://devtrace.thingz.io/score/alice')
  })

  it('shows risk summary when present', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'a', score: { grade: 'A', value: 0.9 }, risk_summary: 'Low risk' } as any,
    }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent).toContain('Low risk')
  })

  it('renders an error message on failure', () => {
    const res: ScoreResult = { ok: false, status: 401, message: 'bad token' }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent?.toLowerCase()).toContain('token')
  })

  it('renders 404 as no-profile message', () => {
    const res: ScoreResult = { ok: false, status: 404, message: 'x' }
    const root = renderCard(host(), 'ghost', res).shadowRoot!
    expect(root.textContent).toContain('No DevTrace profile')
  })
})
```

**Step 2: Run to verify fail**

Run: `npm test -- card.test.ts`
Expected: FAIL

**Step 3: Implement src/card.ts**

Render into a Shadow DOM attached to the given host element. Map errors:
401/403 → "Invalid or missing token" (+ note to open options); 404 → "No DevTrace
profile for @user."; 429 → "Rate limited, try again shortly."; else → the message.
On success show grade chip, `value.toFixed(2)`, optional `risk_summary`, optional
`detail` line, and a "Full review →" anchor to
`https://devtrace.thingz.io/score/<username>`. Include scoped `<style>` inside the
shadow root so GitHub CSS can't leak in. Return the host element.

```ts
import type { ScoreResult } from './types'

const SITE = 'https://devtrace.thingz.io'

// thingz.io brand status colors
const OK = '#22c55e'
const WARN = '#eab308'
const DANGER = '#ef4444'
const MUTED = '#999999'

export function gradeColor(grade: string): string {
  const g = grade.trim().charAt(0).toUpperCase()
  if (g === 'A') return OK
  if (g === 'B' || g === 'C') return WARN
  if (g === 'D' || g === 'F') return DANGER
  return MUTED
}

function errorMessage(status: number, message: string): string {
  if (status === 401 || status === 403) return 'Invalid or missing token — open the extension options to add one.'
  if (status === 429) return 'Rate limited, try again shortly.'
  return message || "Couldn't reach DevTrace."
}

// Dark card matching thingz.io; rendered in an isolated shadow root so it looks
// the same over GitHub's light or dark theme.
const STYLE =
  '<style>:host{all:initial}' +
  '.dt-card{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;border:1px solid #242836;border-radius:12px;padding:12px 14px;background:#0a0a0c;color:#f0f0f0;max-width:280px;box-shadow:0 0 24px #4a9eff25,0 4px 16px rgba(0,0,0,.4)}' +
  '.dt-head{display:flex;align-items:center;gap:8px}' +
  '.dt-grade{font-weight:600;font-size:18px}' +
  '.dt-val{color:#999;font-variant-numeric:tabular-nums}' +
  '.dt-link{color:#4a9eff;text-decoration:none;font-weight:500}' +
  '.dt-risk{margin:8px 0;color:#999}' +
  '.dt-foot{margin-top:8px}' +
  '.dt-err{color:#ef4444}</style>'

export function renderCard(host: HTMLElement, username: string, res: ScoreResult): HTMLElement {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })

  if (!res.ok) {
    const msg = res.status === 404 ? `No DevTrace profile for @${username}.` : errorMessage(res.status, res.message)
    root.innerHTML = `${STYLE}<div class="dt-card"><div class="dt-err">${msg}</div></div>`
    return host
  }

  const d = res.data
  const reviewURL = `${SITE}/score/${encodeURIComponent(username)}`
  const color = gradeColor(d.score.grade)
  const risk = d.risk_summary ? `<div class="dt-risk">${d.risk_summary}</div>` : ''
  const detail = d.detail ? `<div class="dt-risk">${d.detail}</div>` : ''
  root.innerHTML =
    `${STYLE}<div class="dt-card">` +
    `<div class="dt-head"><span class="dt-grade" style="color:${color}">${d.score.grade}</span>` +
    `<span class="dt-val">${d.score.value.toFixed(2)}</span></div>` +
    risk + detail +
    `<div class="dt-foot"><a class="dt-link" href="${reviewURL}" target="_blank" rel="noopener">Full review →</a></div>` +
    `</div>`
  return host
}
```

> Inputs come from the trusted DevTrace API and are rendered inside an isolated
> shadow root, not GitHub's DOM. If we ever render user-controlled strings,
> switch to `textContent`. Note for reviewers in README.

**Step 4: Run to verify pass**

Run: `npm test -- card.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/card.ts __tests__/card.test.ts
git commit -S -m "feat: add shadow-DOM score card renderer"
```

---

## Task 5: Content script (DOM scan, badge inject, SPA nav)

**Files:**
- Create: `src/scan.ts` (pure, testable), `src/content.ts` (glue, manual-tested)
- Test: `__tests__/scan.test.ts`

**Step 1: Write failing test for username extraction**

`scan.ts` holds the pure logic: given a root element, find author/mention anchors
and return `{ el, username }[]`, skipping already-badged nodes.

```ts
import { findContributors, BADGE_ATTR } from '../src/scan'

it('finds author links and dedups badged ones', () => {
  document.body.innerHTML = `
    <a class="author" href="/alice">alice</a>
    <a href="/bob">bob</a>
    <a class="author" data-${BADGE_ATTR}="1" href="/carol">carol</a>
  `
  const found = findContributors(document.body)
  const names = found.map((f) => f.username)
  expect(names).toContain('alice')
  expect(names).not.toContain('carol') // already badged
})

it('extracts username from /user href', () => {
  document.body.innerHTML = `<a class="author" href="/dave?tab=repos">dave</a>`
  expect(findContributors(document.body)[0].username).toBe('dave')
})
```

**Step 2: Run to verify fail**

Run: `npm test -- scan.test.ts`
Expected: FAIL

**Step 3: Implement src/scan.ts**

```ts
export const BADGE_ATTR = 'dtBadged'

const RESERVED = new Set(['orgs', 'sponsors', 'marketplace', 'features', 'topics', 'collections', 'trending', 'about', 'pricing', 'login', 'join'])

export interface Contributor {
  el: HTMLAnchorElement
  username: string
}

export function findContributors(root: ParentNode): Contributor[] {
  const out: Contributor[] = []
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a.author, a[data-hovercard-type="user"]')
  for (const el of anchors) {
    if (el.dataset[BADGE_ATTR]) continue
    const username = usernameFromHref(el.getAttribute('href'))
    if (!username) continue
    out.push({ el, username })
  }
  return out
}

export function usernameFromHref(href: string | null): string | null {
  if (!href) return null
  const path = href.replace(/^https?:\/\/github\.com/, '').split('?')[0].split('#')[0]
  const seg = path.split('/').filter(Boolean)
  if (seg.length !== 1) return null // only bare /user profile links
  const name = seg[0]
  if (RESERVED.has(name.toLowerCase())) return null
  if (!/^[a-zA-Z0-9-]+$/.test(name)) return null
  return name
}
```

**Step 4: Run to verify pass**

Run: `npm test -- scan.test.ts`
Expected: PASS

**Step 5: Implement src/content.ts (glue — manual-tested)**

```ts
import { findContributors, BADGE_ATTR, type Contributor } from './scan'
import { renderCard } from './card'
import type { ScoreRequest, ScoreResult } from './types'

const BADGE_CLASS = 'dt-badge'

function currentRepo(): string | undefined {
  const seg = location.pathname.split('/').filter(Boolean)
  return seg.length >= 2 ? `${seg[0]}/${seg[1]}` : undefined
}

// DevTrace gauge mark, accent-colored, used as the badge glyph.
const GAUGE_SVG =
  '<svg width="12" height="12" viewBox="-4 0 32 32" fill="none" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20A10 10 0 0 1 22 20"/><line x1="12" y1="20" x2="7" y2="9"/><circle cx="12" cy="20" r="2"/></svg>'

function makeBadge(c: Contributor): void {
  c.el.dataset[BADGE_ATTR] = '1'
  const badge = document.createElement('button')
  badge.className = BADGE_CLASS
  badge.innerHTML = GAUGE_SVG
  badge.title = `DevTrace score for @${c.username}`
  badge.style.cssText =
    'display:inline-flex;align-items:center;margin-left:4px;padding:2px;border:1px solid #242836;border-radius:6px;background:#0a0a0c;cursor:pointer;vertical-align:middle;line-height:0'
  badge.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    void openCard(badge, c.username)
  })
  c.el.insertAdjacentElement('afterend', badge)
}

let openHost: HTMLElement | null = null

async function openCard(anchor: HTMLElement, username: string): Promise<void> {
  openHost?.remove()
  const host = document.createElement('span')
  host.style.cssText = 'position:relative;display:inline-block;margin-left:6px;z-index:2147483647'
  anchor.insertAdjacentElement('afterend', host)
  openHost = host
  const req: ScoreRequest = { type: 'SCORE', username, repo: currentRepo() }
  const res: ScoreResult = await chrome.runtime.sendMessage(req)
  renderCard(host, username, res)
}

function scan(): void {
  for (const c of findContributors(document.body)) makeBadge(c)
}

// initial + observe DOM mutations (covers PJAX/Turbo navigation)
scan()
const obs = new MutationObserver(() => scan())
obs.observe(document.body, { childList: true, subtree: true })
document.addEventListener('click', (e) => {
  if (openHost && !openHost.contains(e.target as Node)) {
    openHost.remove()
    openHost = null
  }
})
```

**Step 6: Verify lint**

Run: `npm run lint`
Expected: PASS

**Step 7: Commit**

```bash
git add src/scan.ts src/content.ts __tests__/scan.test.ts
git commit -S -m "feat: add content script badge injection and DOM scanning"
```

---

## Task 6: Options page (token management)

**Files:**
- Create: `public/options.html`, `src/options.ts`
- Test: `__tests__/options.test.ts`

**Step 1: Write failing test for token validation**

```ts
import { isValidToken } from '../src/options'

it('accepts dt_ tokens', () => {
  expect(isValidToken('dt_abc123')).toBe(true)
})
it('rejects empty and non-dt tokens', () => {
  expect(isValidToken('')).toBe(false)
  expect(isValidToken('abc')).toBe(false)
})
```

**Step 2: Run to verify fail**

Run: `npm test -- options.test.ts`
Expected: FAIL

**Step 3: Create public/options.html**

```html
<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>DevTrace Options</title></head>
  <body style="font:14px system-ui;max-width:420px;margin:24px auto">
    <h2>DevTrace</h2>
    <p>Optional API token for deeper scoring. Get one at
      <a href="https://devtrace.thingz.io/settings" target="_blank" rel="noopener">devtrace.thingz.io/settings</a>.</p>
    <input id="token" type="password" placeholder="dt_..." style="width:100%;padding:6px" />
    <div style="margin-top:8px">
      <button id="save">Save</button>
      <button id="clear">Clear</button>
      <span id="status"></span>
    </div>
    <script type="module" src="options.js"></script>
  </body>
</html>
```

**Step 4: Implement src/options.ts**

```ts
export function isValidToken(token: string): boolean {
  return token.startsWith('dt_') && token.length > 3
}

// DOM wiring runs only in the extension context, not under jest.
if (typeof document !== 'undefined' && document.getElementById('save')) {
  const input = document.getElementById('token') as HTMLInputElement
  const status = document.getElementById('status')!

  chrome.storage.sync.get('token').then(({ token }) => {
    if (typeof token === 'string') input.value = token
  })

  document.getElementById('save')!.addEventListener('click', async () => {
    const t = input.value.trim()
    if (!isValidToken(t)) {
      status.textContent = 'Token must start with dt_'
      return
    }
    await chrome.storage.sync.set({ token: t })
    status.textContent = 'Saved.'
  })

  document.getElementById('clear')!.addEventListener('click', async () => {
    await chrome.storage.sync.remove('token')
    input.value = ''
    status.textContent = 'Cleared.'
  })
}
```

**Step 5: Run to verify pass**

Run: `npm test -- options.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add public/options.html src/options.ts __tests__/options.test.ts
git commit -S -m "feat: add options page for API token management"
```

---

## Task 7: Manifest and icons

**Files:**
- Create: `manifest.json`, `public/icons/icon16.png`, `icon48.png`, `icon128.png`

**Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "DevTrace for GitHub",
  "version": "0.1.0",
  "description": "Shows DevTrace contributor trust scores inline on GitHub.",
  "permissions": ["storage"],
  "host_permissions": ["https://devtrace.thingz.io/*"],
  "background": { "service_worker": "background.js", "type": "module" },
  "content_scripts": [
    {
      "matches": ["https://github.com/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_ui": { "page": "options.html", "open_in_tab": true },
  "action": { "default_title": "DevTrace" },
  "icons": { "16": "icons/icon16.png", "48": "icons/icon48.png", "128": "icons/icon128.png" }
}
```

**Step 2: Add icons (thingz.io-aligned)**

Save the DevTrace gauge mark as `public/icons/devtrace.svg` (the SVG in the
Branding section). Generate `icon16.png`, `icon48.png`, `icon128.png` from a
composed source: accent gauge (`#4a9eff` stroke) centered on a `#0a0a0c` rounded
square (radius ≈ 22% of size), matching thingz.io's dark card surface.

Generate the PNGs deterministically with a small Node script using `sharp`
(add `sharp` to devDependencies) so the build is reproducible — do NOT hand-draw:

```js
// scripts/gen-icons.mjs
import sharp from 'sharp'
const gauge = '<path d="M2 20A10 10 0 0 1 22 20" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round" fill="none"/><line x1="12" y1="20" x2="7" y2="9" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round"/><circle cx="12" cy="20" r="2" stroke="#4a9eff" stroke-width="3.5" fill="none"/>'
for (const size of [16, 48, 128]) {
  const r = Math.round(size * 0.22)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32"><rect width="32" height="32" rx="${(r/size)*32}" fill="#0a0a0c"/><g transform="translate(2 1)">${gauge}</g></svg>`
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/icon${size}.png`)
}
```

Add an npm script `"icons": "node scripts/gen-icons.mjs"` and run it.

**Step 3: Build and load unpacked**

Run: `npm run build`
Expected: `dist/` contains `content.js`, `background.js`, `options.js`,
`options.html`, `manifest.json`, `icons/`.

Manual: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.
Visit a GitHub PR/issue/profile; verify a `DT` badge appears next to usernames and
clicking shows the card. Add a token in options; verify deeper fields appear.

**Step 4: Commit**

```bash
git add manifest.json public/icons
git commit -S -m "feat: add MV3 manifest and extension icons"
```

---

## Task 8: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Create the workflow**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
permissions:
  contents: read
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

**Step 2: Commit and verify**

```bash
git add .github/workflows/ci.yml
git commit -S -m "ci: lint, test, and build on push and PR"
```

Push branch and confirm the workflow passes.

---

## Task 9: Release workflow + README

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `README.md`

**Step 1: Release workflow (zip dist on tag)**

```yaml
name: Release
on:
  push: { tags: ['v*'] }
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: cd dist && zip -r ../devtrace-extension.zip .
      - uses: softprops/action-gh-release@v2
        with: { files: devtrace-extension.zip }
```

**Step 2: Expand README**

Document: what it does, install (Web Store link TBD + load-unpacked dev steps),
optional token + how it deepens scoring, the `devtrace.thingz.io/score/<user>`
link, privacy note (token stored locally in `chrome.storage.sync`, only the
clicked username + current repo are sent to DevTrace), reproducible build
(`npm ci && npm run build`), and a note that card content is API-sourced and
rendered in an isolated shadow root.

**Step 3: Commit**

```bash
git add .github/workflows/release.yml README.md
git commit -S -m "ci: add release workflow and expand README"
```

---

## Task 10: Chrome Web Store submission (manual, documented)

Not a code task — checklist in README:

1. Build `dist/` and zip (or download the Release artifact).
2. Create a Chrome Web Store developer account ($5 one-time fee).
3. Upload zip, fill listing: description, screenshots, privacy practices
   (declare `storage` + host access to `devtrace.thingz.io`), link the public repo.
4. Justify permissions: `storage` (token), host permission (score API).
5. Submit for review.

---

## Definition of done

- `npm run lint`, `npm test`, `npm run build` all pass.
- Load-unpacked: badges appear on GitHub, card renders with and without a token,
  options page saves/clears the token, full-review link opens.
- CI green on `main`; tagging produces a Release zip.
- README documents install, privacy, and reproducible build.

## Open questions (carried from design)

1. **Badge placement scope** — v1 targets `a.author` + `a[data-hovercard-type=user]`
   (covers mentions, commit authors, profile links). Expand later if needed.
2. **Branding** — RESOLVED: aligned to thingz.io (dark theme, `#4a9eff` accent,
   DevTrace gauge mark). See Branding section.
3. **Firefox/Edge port** — out of scope for v1.
