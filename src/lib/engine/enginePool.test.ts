import { describe, it, expect } from 'vitest'
import { poolSize } from './enginePool'

describe('poolSize', () => {
  it('leaves a core for the main thread and stops at 4 on machines up to 8 logical cores', () => {
    expect(poolSize(1)).toBe(1)
    expect(poolSize(2)).toBe(1)
    expect(poolSize(4)).toBe(3)
    expect(poolSize(6)).toBe(4)
    expect(poolSize(8)).toBe(4)
  })

  it('runs one instance per two logical cores on bigger machines, up to 8', () => {
    expect(poolSize(10)).toBe(5)
    expect(poolSize(12)).toBe(6)
    expect(poolSize(16)).toBe(8)
    expect(poolSize(32)).toBe(8)
  })
})
