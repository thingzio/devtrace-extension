interface Entry<T> {
  value: T
  expires: number
}

export class TTLCache<T> {
  private store = new Map<string, Entry<T>>()
  constructor(
    private ttlMs: number,
    private clock: () => number = () => Date.now(),
  ) {}

  get(key: string): T | undefined {
    const e = this.store.get(key)
    if (!e) return undefined
    if (this.clock() >= e.expires) {
      this.store.delete(key)
      return undefined
    }
    return e.value
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expires: this.clock() + this.ttlMs })
  }
}
