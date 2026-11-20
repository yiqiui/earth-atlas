import { describe, expect, it } from 'vitest'
import { W, H, CAT_COLOR, CAT_MIN_DIST, ALL_LAYERS, DEFAULT_LAYERS } from './config2'

describe('v2 config', () => {
  it('4K 纹理尺寸', () => {
    expect(W).toBe(7680)
    expect(H).toBe(3840)
  })

  it('所有图层都有颜色与标签距离', () => {
    for (const cat of ALL_LAYERS) {
      expect(CAT_COLOR[cat]).toBeTruthy()
      expect(CAT_MIN_DIST[cat]).toBeGreaterThan(0)
    }
  })

  it('水系默认开启，专题/流域默认关闭', () => {
    expect(DEFAULT_LAYERS).toContain('river')
    expect(DEFAULT_LAYERS).toContain('lake')
    expect(DEFAULT_LAYERS).toContain('ocean')
    expect(DEFAULT_LAYERS).toContain('peak')
    expect(DEFAULT_LAYERS).not.toContain('climate')
    expect(DEFAULT_LAYERS).not.toContain('biome')
    expect(DEFAULT_LAYERS).not.toContain('current')
    expect(ALL_LAYERS).toContain('basin')
    expect(DEFAULT_LAYERS).not.toContain('basin')
  })
})
