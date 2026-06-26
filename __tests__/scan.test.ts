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
