import { fetchScore, APIError } from './api'
import { TTLCache } from './cache'
import type { ScoreRequest, ScoreResult, ScoreResponse } from './types'

const API_URL = 'https://devtrace.thingz.io'
const cache = new TTLCache<ScoreResponse>(5 * 60 * 1000)

async function getToken(): Promise<string | undefined> {
  const { token } = await chrome.storage.sync.get('token')
  return typeof token === 'string' && token ? token : undefined
}

async function handle(req: ScoreRequest): Promise<ScoreResult> {
  const token = await getToken()
  // Repo-context scoring requires a token; sending repo unauthenticated errors.
  const repo = token ? req.repo : undefined
  // Key on the token too, so adding/clearing it busts cached basic/enriched results.
  const key = `${req.username}|${repo ?? ''}|${token ?? ''}`
  const cached = cache.get(key)
  if (cached) return { ok: true, data: cached }

  try {
    const data = await fetchScore(req.username, { apiUrl: API_URL, token, repo })
    cache.set(key, data)
    return { ok: true, data }
  } catch (err) {
    if (err instanceof APIError) return { ok: false, status: err.status, message: err.message }
    return { ok: false, status: 0, message: 'Network error' }
  }
}

chrome.runtime.onMessage.addListener((req: ScoreRequest, _sender, sendResponse) => {
  if (req?.type !== 'SCORE') return
  handle(req).then(sendResponse)
  return true // keep the message channel open for async response
})
