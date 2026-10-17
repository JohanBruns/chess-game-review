import { describe, it, expect, afterEach, vi } from 'vitest'
import { readStorage, writeStorage } from './storage'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('storage', () => {
  it('reads and writes through to localStorage when available', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
    })
    writeStorage('k', 'v')
    expect(readStorage('k')).toBe('v')
    expect(readStorage('missing')).toBeNull()
  })

  it('swallows the SecurityError a blocked storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new DOMException('blocked', 'SecurityError') },
      setItem: () => { throw new DOMException('blocked', 'SecurityError') },
    })
    expect(readStorage('k')).toBeNull()
    expect(() => writeStorage('k', 'v')).not.toThrow()
  })
})
