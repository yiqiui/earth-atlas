/**
 * 从 ArcGIS 上的 Köppen-Geiger 观测气候分类（1901–1925）拉取真实气候分区面，
 * 按教学类别归并后写入 public/data/base/climate.json。
 * 数据为公开服务，按 ALPHACODE 归类；教学描述为科普整理。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const URL_BASE = 'https://services.arcgis.com/nzS0F0zdNLvs7nc8/arcgis/rest/services/' +
  'K%C3%B6ppen_Geiger_Observed_Climate_Shifts_1901_2000__separate_time_slices__WFL1/FeatureServer/0/query'

const CODE_ZONE = {
  Af: 'tropical-rainforest', Am: 'tropical-monsoon', Aw: 'tropical-savanna', As: 'tropical-savanna',
  BWh: 'tropical-desert', BSh: 'tropical-desert', BWk: 'temperate-desert', BSk: 'temperate-desert',
  Cfa: 'subtropical', Cwa: 'subtropical', Cwb: 'subtropical', Cwc: 'subtropical',
  Cfb: 'temperate-maritime', Cfc: 'temperate-maritime',
  Csa: 'mediterranean', Csb: 'mediterranean', Csc: 'mediterranean',
  Dfa: 'temperate-continental', Dfb: 'temperate-continental', Dfc: 'temperate-continental', Dfd: 'temperate-continental',
  Dsa: 'temperate-continental', Dsb: 'temperate-continental', Dsc: 'temperate-continental', Dsd: 'temperate-continental',
  Dwa: 'temperate-monsoon', Dwb: 'temperate-monsoon', Dwc: 'temperate-monsoon', Dwd: 'temperate-monsoon',
  ET: 'polar', EF: 'polar',
}

const ZONE_INFO = {
  'tropical-rainforest': ['热带雨林气候', '终年高温多雨，年温差小。典型：亚马孙平原、刚果盆地、马来群岛。'],
  'tropical-monsoon': ['热带季风气候', '全年高温，分明显旱、雨两季。典型：印度半岛、中南半岛。'],
  'tropical-savanna': ['热带草原气候', '全年高温，干湿季分明。典型：非洲稀树草原、巴西高原。'],
  'tropical-desert': ['热带沙漠气候', '终年炎热干燥，日照强、降水极少。典型：撒哈拉、阿拉伯半岛。'],
  'temperate-desert': ['温带沙漠与草原气候', '冬冷夏热、降水少且变率大。典型：中亚、蒙古高原、北美大平原西部。'],
  subtropical: ['亚热带季风与湿润气候', '夏季高温多雨、冬季温和少雨。典型：中国南方、美国东南部。'],
  mediterranean: ['地中海气候', '夏季炎热干燥、冬季温和多雨，雨热不同期。典型：地中海沿岸、加州、智利中部。'],
  'temperate-maritime': ['温带海洋性气候', '全年温和湿润、降水均匀，受西风与暖流影响。典型：西欧、新西兰。'],
  'temperate-monsoon': ['温带季风气候', '夏季高温多雨、冬季寒冷干燥。典型：中国北方、朝鲜半岛、日本北部。'],
  'temperate-continental': ['温带大陆性气候', '冬冷夏热、年温差大、降水较少。典型：亚欧大陆与北美大陆内部。'],
  polar: ['寒带气候', '终年寒冷，长冬无夏。典型：北极圈以北、南极大陆。'],
}

const params = new URLSearchParams({
  f: 'json', where: '1=1', outFields: 'ALPHACODE,DESCRIPTION', returnGeometry: 'true',
  outSR: '4326', geometryPrecision: '2', maxAllowableOffset: '0.02',
  resultRecordCount: '2000', resultOffset: '0', orderByFields: 'OBJECTID',
})

const features = []
for (let offset = 0; offset < 4000; offset += 2000) {
  params.set('resultOffset', String(offset))
  const res = await fetch(`${URL_BASE}?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  if (json.error) throw new Error(json.error.message)
  features.push(...(json.features || []))
  if ((json.features || []).length < 2000) break
}

const grouped = new Map()
let skipped = 0
for (const f of features) {
  const code = f.attributes?.ALPHACODE
  const zone = CODE_ZONE[code]
  if (!zone || !f.geometry?.rings?.length) { skipped++; continue }
  const arr = grouped.get(zone) ?? []
  for (const ring of f.geometry.rings) {
    const pts = ring.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    if (pts.length >= 4) arr.push(pts)
  }
  grouped.set(zone, arr)
}

const out = []
for (const [zone, polygons] of grouped) {
  if (!polygons.length) continue
  const [zh, desc] = ZONE_INFO[zone]
  out.push({
    type: 'Feature', id: zone,
    properties: {
      name: zh, name_zh: zh, name_en: zone,
      featurecla: 'climate', zone, teaching: desc, desc,
      facts: [['气候特征', desc.split('。')[0]], ['典型分布', desc.split('：')[1] ?? '']],
    },
    geometry: { type: 'MultiPolygon', coordinates: polygons.map(p => [p]) },
  })
}

const dest = path.join(root, 'public', 'data', 'base', 'climate.json')
fs.writeFileSync(dest, JSON.stringify({ type: 'FeatureCollection', features: out }))
console.log(`climate.json: ${out.length} 类气候 / ${features.length} 个 Köppen 面（跳过 ${skipped}），${(fs.statSync(dest).size / 1024).toFixed(0)} KB`)
