import { findContributors, usernameFromHref, BADGE_ATTR } from '../src/scan'

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

it('skips avatar links (anchors wrapping an image) and badges only the text name', () => {
  document.body.innerHTML = `
    <a class="author" data-hovercard-type="user" href="/erin"><img src="/a.png" alt="erin"/></a>
    <a class="author" href="/erin">erin</a>
  `
  const found = findContributors(document.body)
  // both anchors point to the same profile; only the textual one is badged
  expect(found.length).toBe(1)
  expect(found[0].el.querySelector('img')).toBeNull()
  expect(found[0].username).toBe('erin')
})

it('extracts username from absolute github.com profile URLs', () => {
  expect(usernameFromHref('https://github.com/frank')).toBe('frank')
  expect(usernameFromHref('http://github.com/frank#top')).toBe('frank')
})

it('rejects hosts that merely start with github.com', () => {
  expect(usernameFromHref('https://github.com')).toBeNull()
  expect(usernameFromHref('https://github.comx')).toBeNull()
  expect(usernameFromHref('https://github.com-evil')).toBeNull()
  expect(usernameFromHref('https://github.company/frank')).toBeNull()
  expect(usernameFromHref('https://github.com.evil.io/frank')).toBeNull()
})
