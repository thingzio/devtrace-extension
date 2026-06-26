import { renderCard, gradeColor } from '../src/card'
import type { ScoreResult } from '../src/types'

function host(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

describe('gradeColor', () => {
  it('maps grade families to brand status colors', () => {
    expect(gradeColor('A+')).toBe('#22c55e')
    expect(gradeColor('B-')).toBe('#eab308')
    expect(gradeColor('C')).toBe('#eab308')
    expect(gradeColor('D')).toBe('#ef4444')
    expect(gradeColor('F')).toBe('#ef4444')
    expect(gradeColor('?')).toBe('#999999')
  })
})

describe('renderCard', () => {
  it('shows grade, value and full-review link on success', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'alice', score: { grade: 'B-', value: 0.67 } } as any,
    }
    const root = renderCard(host(), 'alice', res).shadowRoot!
    expect(root.textContent).toContain('B-')
    expect(root.textContent).toContain('0.67')
    const link = root.querySelector('a[href]') as HTMLAnchorElement
    expect(link.href).toBe('https://devtrace.thingz.io/score/alice')
  })

  it('shows risk summary when present', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'a', score: { grade: 'A', value: 0.9 }, risk_summary: 'Low risk' } as any,
    }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent).toContain('Low risk')
  })

  it('links the breakdown to the user score page and shows no "Full review" CTA', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'alice', score: { grade: 'C-', value: 0.54 }, detail: 'Sign up for full signal breakdown -> devtrace.thingz.io' } as any,
    }
    const root = renderCard(host(), 'alice', res).shadowRoot!
    expect(root.textContent).toContain('See full signal breakdown at')
    expect(root.textContent).not.toContain('Sign up')
    expect(root.textContent).not.toContain('Full review')
    const siteLink = Array.from(root.querySelectorAll('a')).find((a) => a.textContent === 'devtrace.thingz.io')
    expect(siteLink?.getAttribute('href')).toBe('https://devtrace.thingz.io/score/alice')
  })

  it('renders the category breakdown as bars when categories are present', () => {
    const res: ScoreResult = {
      ok: true,
      data: {
        username: 'alice',
        score: { grade: 'A', value: 0.9, categories: { behavioral: 0.28, community: 0.25, engagement: 0.05, identity: 0.32 } },
      } as any,
    }
    const root = renderCard(host(), 'alice', res).shadowRoot!
    const text = root.textContent ?? ''
    expect(text).toContain('behavioral')
    expect(text).toContain('0.28')
    expect(text).toContain('identity')
    expect(text).toContain('0.32')
    const fills = root.querySelectorAll('.dt-bar-f')
    expect(fills.length).toBe(4)
    // bar width is proportional to the value (0.28 -> 28%)
    expect((fills[0] as HTMLElement).style.width).toBe('28%')
  })

  it('shows "needs repo" for a non-numeric category and flags suspended accounts', () => {
    const res: ScoreResult = {
      ok: true,
      data: {
        username: 'mal',
        score: { grade: 'F', value: 0.1, categories: { identity: 0.2, code_provenance: null as any } },
        signals: { suspended: true },
      } as any,
    }
    const root = renderCard(host(), 'mal', res).shadowRoot!
    expect(root.textContent).toContain('code provenance')
    expect(root.textContent).toContain('needs repo')
    expect(root.textContent).toContain('Account suspended')
  })

  it('omits the category breakdown in basic mode', () => {
    const basic: ScoreResult = {
      ok: true,
      data: { username: 'a', score: { grade: 'C-', value: 0.54 }, detail: 'x' } as any,
    }
    const root = renderCard(host(), 'a', basic).shadowRoot!
    expect(root.querySelector('.dt-cats')).toBeNull()
  })

  it('renders an error message on failure', () => {
    const res: ScoreResult = { ok: false, status: 401, message: 'bad token' }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent?.toLowerCase()).toContain('token')
  })

  it('renders 404 as no-profile message', () => {
    const res: ScoreResult = { ok: false, status: 404, message: 'x' }
    const root = renderCard(host(), 'ghost', res).shadowRoot!
    expect(root.textContent).toContain('No DevTrace profile')
  })

  it('neutralizes XSS in dynamic strings via textContent', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'x', score: { grade: 'A', value: 0.5 }, risk_summary: '<img src=x onerror=alert(1)>' } as any,
    }
    const root = renderCard(host(), 'x', res).shadowRoot!
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toContain('<img src=x onerror=alert(1)>')
  })

  it('renders 429 as rate-limited message', () => {
    const res: ScoreResult = { ok: false, status: 429, message: 'x' }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent?.toLowerCase()).toContain('rate limited')
  })

  it('renders non-finite value as em dash without throwing', () => {
    const res: ScoreResult = {
      ok: true,
      data: { username: 'a', score: { grade: 'A', value: 'oops' as any } } as any,
    }
    const root = renderCard(host(), 'a', res).shadowRoot!
    expect(root.textContent).toContain('—')
  })
})
