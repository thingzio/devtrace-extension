export const BADGE_ATTR = 'dtbadged'

const RESERVED = new Set(['orgs', 'sponsors', 'marketplace', 'features', 'topics', 'collections', 'trending', 'about', 'pricing', 'login', 'join', 'settings', 'notifications', 'explore'])

export interface Contributor {
  el: HTMLAnchorElement
  username: string
}

export function findContributors(root: ParentNode): Contributor[] {
  const out: Contributor[] = []
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a.author, a[data-hovercard-type="user"]')
  for (const el of anchors) {
    if (el.dataset[BADGE_ATTR]) continue
    // Skip avatar links (they wrap an <img>) and any anchor without visible
    // text, so the badge attaches only to the actual textual username — not
    // its duplicate avatar link pointing at the same profile.
    if (el.querySelector('img, svg')) continue
    if (!el.textContent || !el.textContent.trim()) continue
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
