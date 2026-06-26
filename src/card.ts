import type { ScoreResult } from './types'

const SITE = 'https://devtrace.thingz.io'

// thingz.io brand status colors
const OK = '#22c55e'
const WARN = '#eab308'
const DANGER = '#ef4444'
const MUTED = '#999999'

const CSS =
  ':host{all:initial}' +
  '.dt-card{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;border:1px solid #242836;border-radius:12px;padding:12px 14px;background:#0a0a0c;color:#f0f0f0;max-width:280px;box-shadow:0 0 24px #4a9eff25,0 4px 16px rgba(0,0,0,.4)}' +
  '.dt-head{display:flex;align-items:center;gap:8px}' +
  '.dt-grade{font-weight:600;font-size:18px}' +
  '.dt-val{color:#999;font-variant-numeric:tabular-nums}' +
  '.dt-link{color:#4a9eff;text-decoration:none;font-weight:500}' +
  '.dt-risk{margin:8px 0;color:#999}' +
  '.dt-foot{margin-top:8px}' +
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
  head.append(grade, el('span', 'dt-val', valueText))
  card.append(head)

  if (d.risk_summary) card.append(el('div', 'dt-risk', d.risk_summary))
  if (d.detail) card.append(el('div', 'dt-risk', d.detail))

  const foot = el('div', 'dt-foot')
  const link = el('a', 'dt-link', 'Full review →')
  link.href = `${SITE}/score/${encodeURIComponent(username)}`
  link.target = '_blank'
  link.rel = 'noopener'
  foot.append(link)
  card.append(foot)

  return host
}
