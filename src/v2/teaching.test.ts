import { describe, expect, it } from 'vitest'
import { ensureDetail, detailStats, type DetailContext } from './teaching'
import type { Rec } from './data4'
import { ALL_LAYERS } from './config2'

const rec = (cat: string): Rec => ({
  id: 'x', name: '测试地貌', names: { zh: '测试地貌' }, cat: cat as Rec['cat'],
  lat: 35.2, lon: 110.4, source: 'test', updatedAt: '',
})

const ctx: DetailContext = {
  climate: '温带季风气候', elevation: 860, parent: '黄河流域', nearby: ['华山', '渭河'],
}

describe('通用教学详情', () => {
  it('19 个图层类别都能生成中文详情与事实表', () => {
    for (const cat of ALL_LAYERS) {
      const r = rec(cat)
      expect(ensureDetail(r, ctx)).toBe(true)
      expect(r.desc).toBeTruthy()
      expect(!/[A-Za-z]{4,}/.test(r.desc!)).toBe(true)
      expect(r.facts!.length).toBeGreaterThanOrEqual(4)
      expect(ensureDetail(r, ctx)).toBe(false)
    }
  })

  it('已有描述与事实不被覆盖', () => {
    const r = rec('peak'); r.desc = '原有描述'; r.facts = [['高度', '1000 m']]
    ensureDetail(r, ctx)
    expect(r.desc).toBe('原有描述')
    expect(r.facts).toEqual([['高度', '1000 m']])
  })

  it('统计缺详情要素', () => {
    const a = rec('lake'), b = rec('river'); b.desc = '有描述'; b.facts = [['长度', '100 km']]
    expect(detailStats([a, b])).toEqual({ total: 2, noDesc: 1, noFacts: 1 })
  })
})
