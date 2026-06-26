export function isValidToken(token: string): boolean {
  return token.startsWith('dt_') && token.length > 3
}

// DOM wiring runs only in the extension context, not under jest.
if (typeof document !== 'undefined' && document.getElementById('save')) {
  const input = document.getElementById('token') as HTMLInputElement
  const status = document.getElementById('status')!

  chrome.storage.sync.get('token').then(({ token }) => {
    if (typeof token === 'string') input.value = token
  })

  document.getElementById('save')!.addEventListener('click', async () => {
    const t = input.value.trim()
    if (!isValidToken(t)) {
      status.textContent = 'Token must start with dt_'
      return
    }
    await chrome.storage.sync.set({ token: t })
    status.textContent = 'Saved.'
  })

  document.getElementById('clear')!.addEventListener('click', async () => {
    await chrome.storage.sync.remove('token')
    input.value = ''
    status.textContent = 'Cleared.'
  })
}
