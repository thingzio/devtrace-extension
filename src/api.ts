import type { ScoreResponse } from './types'

export interface FetchScoreOpts {
  apiUrl: string
  token?: string
  repo?: string
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
