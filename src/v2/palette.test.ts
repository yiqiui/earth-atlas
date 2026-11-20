import { describe, expect, it } from 'vitest'
import { areaColor, basinColor, hashOf, subbasinColor, zoneZh } from './palette'
import { ZONE_COLOR, AREA_CATS, ALL_LAYERS, CAT_COLOR } from './config2'

describe('专题配色', () => {
  it('同一名称颜色稳定，不同流域颜色不同', () => {
    expect(basinColor('长江流域')).toBe(basinColor('长江流域'))
    expect(basinColor('长江流域')).not.toBe(basinColor('黄河流域'))
    expect(hashOf('abc')).toBe(hashOf('abc'))
  })

  it('子流域在父流域色相内展开且互不撞色', () => {
    const a = subbasinColor('四川', '长江流域', 0, 5)
    const b = subbasinColor('湖北', '长江流域', 4, 5)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('气候/植被按 zone 稳定取色，未知 zone 回退类色', () => {
    expect(areaColor({ cat: 'climate', name: 'x', zone: 'temperate-maritime' }))
      .toBe(ZONE_COLOR['temperate-maritime'])
    expect(areaColor({ cat: 'climate', name: 'x', zone: '???' })).toBe(CAT_COLOR.climate)
    expect(zoneZh('temperate-maritime')).toBe('温带海洋性气候')
  })

  it('全部面类别都在统一图层清单内', () => {
    for (const cat of AREA_CATS) expect(ALL_LAYERS).toContain(cat)
  })
})
