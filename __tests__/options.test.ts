import { isValidToken } from '../src/options'

it('accepts dt_ tokens', () => {
  expect(isValidToken('dt_abc123')).toBe(true)
})
it('rejects empty and non-dt tokens', () => {
  expect(isValidToken('')).toBe(false)
  expect(isValidToken('abc')).toBe(false)
})
