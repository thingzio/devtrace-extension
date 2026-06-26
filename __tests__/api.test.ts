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

  it('fetches the URL built by buildURL', async () => {
    const f = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ username: 'alice' }), { status: 200 }),
    )
    await fetchScore('alice', { apiUrl: 'https://x', repo: 'o/r' })
    expect(f.mock.calls[0][0]).toBe('https://x/api/v1/score/alice?repo=o%2Fr')
  })

  it('throws APIError on non-ok', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ error: 'nope' }), { status: 401 }),
    )
    await expect(fetchScore('alice', { apiUrl: 'https://x' })).rejects.toMatchObject({
      status: 401,
    })
    await expect(fetchScore('alice', { apiUrl: 'https://x' })).rejects.toThrow(/nope/)
  })
})
