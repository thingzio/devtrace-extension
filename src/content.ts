import { findContributors, BADGE_ATTR, type Contributor } from './scan'
import { renderCard } from './card'
import type { ScoreRequest, ScoreResult } from './types'

const BADGE_CLASS = 'dt-badge'

// DevTrace gauge mark (thingz.io), accent-colored, as the badge glyph.
const GAUGE_SVG =
  '<svg width="12" height="12" viewBox="-4 0 32 32" fill="none" stroke="#4a9eff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20A10 10 0 0 1 22 20"/><line x1="12" y1="20" x2="7" y2="9"/><circle cx="12" cy="20" r="2"/></svg>'

function currentRepo(): string | undefined {
  const seg = location.pathname.split('/').filter(Boolean)
  return seg.length >= 2 ? `${seg[0]}/${seg[1]}` : undefined
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

function scan(): void {
  for (const c of findContributors(document.body)) makeBadge(c)
}

scan()
const obs = new MutationObserver(() => scan())
obs.observe(document.body, { childList: true, subtree: true })
document.addEventListener('click', (e) => {
  if (openHost && !openHost.contains(e.target as Node)) {
    openHost.remove()
    openHost = null
  }
})
