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
