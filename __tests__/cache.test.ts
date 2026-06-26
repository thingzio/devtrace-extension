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
