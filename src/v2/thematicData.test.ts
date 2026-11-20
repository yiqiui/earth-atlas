import { describe, expect, it } from 'vitest'
import climate from '../../public/data/base/climate.json'
import currents from '../../public/data/base/currents.json'
import biomes from '../../public/data/base/biomes.json'
import fjords from '../../public/data/base/fjords.json'
import swamps from '../../public/data/base/swamps.json'
import { parseCoordQuery } from './geoSearch'
import { basinFacts, zhWaterProvince } from './basinFacts'

const DATA: Record<string, any> = { climate, currents, biomes, fjords, swamps }

describe('专题数据完整性', () => {
  it('气候/洋流/植被/峡湾/沼泽 JSON 均存在且非空', () => {
    for (const f of Object.keys(DATA)) {
      expect(DATA[f].type).toBe('FeatureCollection')
      expect(DATA[f].features.length).toBeGreaterThan(0)
    }
  })

  it('所有专题要素都有中文名与教学说明', () => {
    for (const f of Object.keys(DATA)) {
      for (const x of DATA[f].features) {
        expect(x.properties.name).toBeTruthy()
        expect(/[一-鿿]/.test(x.properties.name)).toBe(true)
        expect(x.properties.teaching || x.properties.desc).toBeTruthy()
      }
    }
  })

  it('气候覆盖温带海洋性等主要课本类型', () => {
    const zones = new Set(climate.features.map((f: any) => f.properties.zone))
    expect(zones.has('temperate-maritime')).toBe(true)
    expect(zones.has('temperate-monsoon')).toBe(true)
    expect(zones.has('mediterranean')).toBe(true)
  })
})

describe('坐标搜索与流域资料', () => {
  it('解析多种经纬度写法', () => {
    expect(parseCoordQuery('39.9,116.4')).toEqual({ lat: 39.9, lon: 116.4 })
    expect(parseCoordQuery('-33.9 151.2')).toEqual({ lat: -33.9, lon: 151.2 })
    expect(parseCoordQuery('N39.9 E116.4')).toEqual({ lat: 39.9, lon: 116.4 })
    expect(parseCoordQuery('S33.9 W70.6')).toEqual({ lat: -33.9, lon: -70.6 })
    expect(parseCoordQuery('长江')).toBeNull()
    expect(parseCoordQuery('99,999')).toBeNull()
  })

  it('子流域中文名与面积象限齐全', () => {
    expect(zhWaterProvince('China Sichuan Yangtze', 'China', 'Sichuan')).toContain('四川')
    const facts = basinFacts('长江流域', {
      areaKm2: 459050, parentAreaKm2: 1800974, rank: 1, total: 17,
      country: 'China', isSub: true, climate: '亚热带季风气候',
    })
    const keys = facts.map(([k]) => k)
    expect(keys).toContain('流域面积')
    expect(keys).toContain('占父流域比例')
    expect(keys).toContain('面积排名')
    expect(keys).toContain('年径流量')
  })
})
