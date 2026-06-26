import type { ScoreResult } from './types'

const SITE = 'https://devtrace.thingz.io'

// thingz.io brand status colors
const OK = '#22c55e'
const WARN = '#eab308'
const DANGER = '#ef4444'
const MUTED = '#999999'

// The card is an absolutely-positioned overlay anchored to the badge, so it
// floats over the page instead of taking layout space and shoving siblings.
const CSS =
  ':host{all:initial}' +
  '.dt-card{position:absolute;top:100%;left:0;margin-top:6px;z-index:2147483647;' +
  'font:13px/1.45 ui-sans-serif,system-ui,sans-serif;border:1px solid #242836;border-radius:10px;' +
  'padding:10px 14px;background:#0a0a0c;color:#f0f0f0;width:380px;max-width:80vw;' +
  'box-shadow:0 0 24px #4a9eff25,0 4px 16px rgba(0,0,0,.4)}' +
  '.dt-head{display:flex;align-items:baseline;gap:10px}' +
  '.dt-grade{font-weight:600;font-size:18px}' +
  '.dt-val{color:#999;font-variant-numeric:tabular-nums}' +
  '.dt-link{color:#4a9eff;text-decoration:none;font-weight:500}' +
  '.dt-risk{margin:5px 0 0;color:#999}' +
  '.dt-cats{margin-top:10px;display:flex;flex-direction:column;gap:5px}' +
  '.dt-cat{display:grid;grid-template-columns:96px 1fr 40px;align-items:center;gap:10px}' +
  '.dt-cat-l{color:#999;text-transform:capitalize}' +
  '.dt-bar{height:8px;background:#171a22;border-radius:4px;overflow:hidden}' +
  '.dt-bar-f{height:100%;background:#4a9eff}' +
  '.dt-cat-v{color:#f0f0f0;text-align:right;font-variant-numeric:tabular-nums}' +
  '.dt-cat-na{color:#555;font-size:11px;text-align:right}' +
  '.dt-flag{margin-top:8px;color:#ef4444;font-weight:600}' +
  '.dt-foot{margin-top:10px}' +
  '.dt-err{color:#ef4444}'

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

function catLabel(key: string): string {
  return key.replace(/_/g, ' ')
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// Renders into an isolated shadow root; all dynamic values use textContent so
// API/page-sourced strings cannot inject markup.
export function renderCard(host: HTMLElement, username: string, res: ScoreResult): HTMLElement {
  const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' })
  root.replaceChildren()

  const style = document.createElement('style')
  style.textContent = CSS
  const card = el('div', 'dt-card')
  root.append(style, card)

  if (!res.ok) {
    const msg = res.status === 404 ? `No DevTrace profile for @${username}.` : errorMessage(res.status, res.message)
    card.append(el('div', 'dt-err', msg))
    return host
  }

  const d = res.data
  const value = Number(d.score.value)
  const valueText = Number.isFinite(value) ? value.toFixed(2) : '—'

  const head = el('div', 'dt-head')
  const grade = el('span', 'dt-grade', d.score.grade)
  grade.style.color = gradeColor(d.score.grade)
  head.append(grade, el('span', 'dt-val', `Score ${valueText}`))
  card.append(head)

  if (d.risk_summary) card.append(el('div', 'dt-risk', d.risk_summary))

  // Authenticated responses carry the per-category score breakdown; show it as
  // labeled bars. A non-numeric category (e.g. code provenance without repo
  // context) renders a "needs repo" hint instead of a bar.
  const cats = d.score.categories
  if (cats && Object.keys(cats).length > 0) {
    const wrap = el('div', 'dt-cats')
    for (const [key, raw] of Object.entries(cats)) {
      const row = el('div', 'dt-cat')
      row.append(el('span', 'dt-cat-l', catLabel(key)))
      const track = el('div', 'dt-bar')
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        const pct = Math.max(0, Math.min(1, raw)) * 100
        const fill = el('div', 'dt-bar-f')
        fill.style.width = `${+pct.toFixed(2)}%`
        track.append(fill)
        row.append(track, el('span', 'dt-cat-v', raw.toFixed(2)))
      } else {
        row.append(track, el('span', 'dt-cat-na', 'needs repo'))
      }
      wrap.append(row)
    }
    card.append(wrap)
  }

  if (d.signals?.suspended) card.append(el('div', 'dt-flag', '⚠ Account suspended'))

  // The card only shows a summary; link to the user's full breakdown page.
  const foot = el('div', 'dt-foot')
  foot.append('See full signal breakdown at ')
  const link = el('a', 'dt-link', 'devtrace.thingz.io')
  link.href = `${SITE}/score/${encodeURIComponent(username)}`
  link.target = '_blank'
  link.rel = 'noopener'
  foot.append(link)
  card.append(foot)

  return host
}
