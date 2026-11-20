import { describe, expect, it } from 'vitest'
import { LOD, lodFor, simplifyRing } from './lod'

describe('渲染 LOD', () => {
  it('远景/中景/近景分档且带滞回', () => {
    expect(lodFor(3.6, 'near')).toBe('far')
    expect(lodFor(2.4, 'far')).toBe('far')      // 2.2–2.6 区间保持原档
    expect(lodFor(2.1, 'far')).toBe('mid')
    expect(lodFor(1.2, 'mid')).toBe('near')
    expect(lodFor(1.4, 'near')).toBe('near')    // 1.3–1.45 区间保持原档
    expect(lodFor(1.6, 'near')).toBe('mid')
  })

  it('简化环保留闭合与首尾点', () => {
    const ring: [number, number][] = []
    for (let i = 0; i < 1000; i++) ring.push([i / 10, Math.sin(i / 50)])
    ring.push(ring[0])
    const out = simplifyRing(ring, 120)
    expect(out.length).toBe(121)
    expect(out[0]).toEqual(ring[0])
    expect(out[out.length - 1]).toEqual(out[0])
  })

  it('远景参数显著低于近景', () => {
    expect(LOD.far.riverPts).toBeLessThan(LOD.near.riverPts / 2)
    expect(LOD.far.ringPts).toBeLessThan(LOD.near.ringPts / 10)
    expect(LOD.far.subdiv).toBeGreaterThan(LOD.near.subdiv)
    expect(LOD.far.edges).toBe(false)
  })
})
