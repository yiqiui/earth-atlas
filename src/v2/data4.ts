import { BASE, type Cat, ALL_LAYERS } from './config2'
import { toChineseName } from './geoNames'

export interface Rec {
  id: string
  name: string
  nameEn?: string
  names: Record<string, string>
  cat: Cat
  lat: number
  lon: number
  path?: [number, number][]            // 线要素：[lon,lat][]
  rings?: [number, number][][]          // 面要素：多个外环，每环 [lon,lat][]
  holes?: [number, number][][]          // 面要素：内洞（属于包含它的外环）
  rank?: number
  temp?: 'warm' | 'cold'
  zone?: string
  parent?: string                        // 子流域所属大流域
  colorIndex?: number                    // 同类面要素的稳定配色序号
  colorTotal?: number
  teaching?: string
  facts?: [string, string][]
  desc?: string
  source: string
  updatedAt: string
}
interface GeoGeom { type: string; coordinates: any }
interface GeoFeat { type: string; id?: any; properties?: any; geometry: GeoGeom | null }

function splitCross(ring: any): [number, number][] {
  if (!Array.isArray(ring) || ring.length < 2) return []
  let seg: [number, number][] = [[ring[0][0], ring[0][1]]]
  const out: [number, number][] = []
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i]
    if (!Array.isArray(b) || b.length < 2) continue
    if (Math.abs(b[0] - a[0]) > 180) { if (seg.length > 1) out.push(...seg); seg = [[b[0], b[1]]] }
    else seg.push([b[0], b[1]])
  }
  if (seg.length > 1) out.push(...seg)
  return out
}

/** 从几何提取所有线（河流）或面环（海域）。 */
function geometryRings(geom: GeoGeom | null): [number, number][][] {
  if (!geom) return []
  const c = geom.coordinates
  if (geom.type === 'Point') return [[c[0], c[1]]]
  if (geom.type === 'MultiPoint') return c.map((p: number[]) => [p[0], p[1]] as [number, number])
  if (geom.type === 'LineString') return [splitCross(c)]
  if (geom.type === 'MultiLineString') return c.map(splitCross).filter((r: any[]) => r.length > 1)
  if (geom.type === 'Polygon') return [splitCross(c[0])]
  if (geom.type === 'MultiPolygon') return c.map((p: any) => splitCross(p[0])).filter((r: any[]) => r.length > 1)
  return []
}

/** 质心（取最大环的平均点，比首顶点更接近真实位置）。 */
function anchorOf(rings: [number, number][][]): [number, number] | null {
  if (!rings.length) return null
  const ring = rings.reduce((a, b) => b.length > a.length ? b : a, rings[0])
  // Point 要素的「环」就是一个点 [lon,lat]
  if (typeof ring[0] === 'number' && typeof ring[1] === 'number') return [ring[0], ring[1]]
  let lon = 0, lat = 0
  for (const p of ring) { lon += p[0]; lat += p[1] }
  return [lon / ring.length, lat / ring.length]
}

function catFrom(fcName: string, props: any): Cat {
  const raw = `${props.featurecla ?? props.FEATURECLA ?? props.type ?? ''} ${props.name ?? ''}`.toLowerCase()
  if (/gulf|湾/.test(raw)) return 'gulf'
  if (/bay/.test(raw)) return 'bay'
  if (/strait|海峡/.test(raw)) return 'strait'
  if (/cape|海角/.test(raw)) return 'cape'
  if (/island|岛/.test(raw)) return 'island'
  if (/lake|湖/.test(raw)) return 'lake'
  if (/ocean|海/.test(raw)) return 'ocean'
  if (/river|河|江/.test(raw)) return 'river'
  if (/peak|mountain|峰|山/.test(raw)) return 'peak'
  if (fcName === 'islands') return 'island'
  if (fcName === 'marine') return 'gulf'
  if (fcName === 'places') return 'peak'
  return 'land'
}

function geoToRecs(json: any, source: string, fcName: string): Rec[] {
  if (!json || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) return []
  const updatedAt = new Date().toISOString()
  const out: Rec[] = []
  for (const f of json.features as GeoFeat[]) {
    const rings = geometryRings(f.geometry)
    const anchor = anchorOf(rings)
    if (!anchor) continue
    const props = f.properties ?? {}
    const en = props.name_en ?? props.NAME_EN ?? props['name:en'] ?? props.name ?? ''
    // 中文名优先用 NE 字段，否则查内置译名库；都没有则留空（不再把英文名塞进 zh）
    // 专题 JSON 的 name 已是中文；优先采用，避免 fallback 把中文名误判为未翻译
    const zh = props.name_zh ?? props.NAME_ZH ?? props['name:zh']
      ?? (/[一-鿿]/.test(String(props.name ?? '')) ? String(props.name) : toChineseName(en)) ?? ''
    const name = zh || en || '未命名'
    if (name === '未命名' && !en) continue
    // 专题 JSON 明确指定 cat（如 climate/biome/fjord/swamp），避免被 catFrom 的「湾/海」正则误判
    const explicit = String(props.cat ?? props.featurecla ?? '').toLowerCase()
    const cat: Cat = (['climate', 'biome', 'current', 'fjord', 'swamp', 'basin', 'subbasin'] as Cat[]).includes(explicit as Cat)
      ? explicit as Cat : catFrom(fcName, props)
    if (!ALL_LAYERS.includes(cat)) continue
    if (/水库|水庫|大坝|大壩|水坝|運河|运河|渠|dam|reservoir|canal/i.test(`${name} ${en}`)) continue
    const rank = props.scalerank ?? props.SCALERANK
    const rec: Rec = {
      id: `${source}:${f.id ?? `${name}-${anchor[1].toFixed(3)}-${anchor[0].toFixed(3)}`}`,
      name, nameEn: en && en !== name ? en : undefined,
      names: { zh: name, 'zh-TW': props.name_zht ?? props.NAME_ZHT ?? name, en },
      cat, lat: anchor[1], lon: anchor[0], source, updatedAt,
    }
    if (rings.length) {
      if (cat === 'river' || cat === 'current') rec.path = rings[0]
      else rec.rings = rings  // 面要素保留完整边界
    }
    if (typeof rank === 'number') rec.rank = rank
    if (props.zone) rec.zone = String(props.zone)
    if (props.parent) rec.parent = String(props.parent)
    if (props.temp === 'warm' || props.temp === 'cold') rec.temp = props.temp
    if (props.teaching) rec.teaching = String(props.teaching)
    if (Array.isArray(props.facts)) rec.facts = props.facts
    if (props.desc) rec.desc = String(props.desc)
    out.push(rec)
  }
  return out
}

/** 内置地理风貌描述库（教学性），按名称匹配注入，无需联网。 */
const DESCRIPTIONS: Record<string, string> = {
  '长江': '亚洲最长河流，全长约6300公里，发源于青藏高原唐古拉山脉，流经11个省级行政区注入东海。上游穿行峡谷、水能丰富，中下游江面宽阔、航运发达，是中国的"黄金水道"。',
  '黄河': '中国第二长河，全长约5464公里，发源于青藏高原巴颜喀拉山，流经黄土高原携带大量泥沙，在下游形成"地上河"，最终注入渤海。是中华文明的主要发源地。',
  '湄公河': '东南亚最重要的国际河流，在中国境内称澜沧江，流经缅甸、老挝、泰国、柬埔寨、越南，注入南海。沿岸冲积平原是重要农业区，河口三角洲（湄公河三角洲）是越南粮仓。',
  '珠穆朗玛峰': '地球海拔最高点（8848.86米），位于喜马拉雅山脉中段中国与尼泊尔边界，山体呈巨型金字塔状，北坡为青藏高原，南坡直落尼泊尔谷地。',
  '南海': '中国南部海域，面积约350万平方公里，是西太平洋最大的边缘海之一。海域内分布东沙、西沙、中沙、南沙四大群岛，蕴藏丰富的油气与渔业资源。',
  '东海': '中国东部海域，北接黄海、南连南海，海域面积约77万平方公里。大陆架宽广，渔业资源丰富，钓鱼岛及其附属岛屿位于海域东部。',
  '台湾岛': '中国第一大岛，面积约3.6万平方公里，西隔台湾海峡与福建省相望。岛中央山脉纵贯南北，最高峰玉山海拔3952米，西部为开阔平原。',
  '海南岛': '中国第二大岛，面积约3.4万平方公里，地处热带，中部五指山为最高峰，四周为热带雨林与海岸平原，周边海域盛产珊瑚与渔业资源。',
  '夏威夷群岛': '太平洋中部的火山群岛，由热点火山活动形成，包含夏威夷岛、茂宜岛、欧胡岛等。夏威夷岛上的冒纳罗亚火山是全球最活跃的活火山之一，群岛以火山地貌、热带海滩和峡谷著称。',
  '青藏高原': '世界海拔最高、面积最大的高原，平均海拔4000米以上，有"世界屋脊"之称。是长江、黄河、雅鲁藏布江等亚洲大河的发源地，雪山冰川广布。',
  '亚马孙河': '世界流量最大、流域面积最广的河流，位于南美洲，全长约6400公里，流经亚马孙热带雨林注入大西洋。',
  '尼罗河': '世界最长河流之一，全长约6670公里，发源于东非高原，流经撒哈拉沙漠注入地中海，是古埃及文明的摇篮。',
  '贝加尔湖': '世界最深、蓄水量最大的淡水湖，位于俄罗斯西伯利亚，最深处达1637米，呈狭长新月形。',
  '大堡礁': '世界最大的珊瑚礁群，位于澳大利亚东北海岸，绵延2000多公里，由数千个珊瑚礁和岛屿组成，是著名的海洋生态景观。',
}

const FILES = [
  'rivers', 'lakes', 'oceans', 'land', 'marine', 'places', 'regions', 'islands',
  'climate', 'biomes', 'currents', 'fjords', 'swamps',
] as const
/**
 * 中文名兜底：names.zh / names['zh-TW'] 缺失或仍是拉丁字母时，查内置译名库；
 * 仍无译名的保留原文（宁可显示原文也不错译）。
 * 同时把原文拉丁名落到 nameEn（外文界面仍显示原文），供在线高精度河道等新数据复用。
 */
const isLatin = (s: string) => !!s && !/[一-鿿]/.test(s)
/** 混排名（如「Natashquan河」）也算未翻译：去掉中文后缀再查译名库。 */
const latinMix = (s: string) => /[A-Za-z]{3,}/.test(s)
const lookupName = (s: string) => s.replace(/[河江江湖山岭峰海峡湾岛]+$/g, '').trim()
export function applyChineseFallback(records: Rec[]): void {
  for (const r of records) {
    if (!r.nameEn && isLatin(r.name)) r.nameEn = r.name
    const source = r.nameEn || r.name
    let zh: string | null = null
    if (!r.names.zh || isLatin(r.names.zh) || latinMix(r.names.zh)) {
      zh = toChineseName(lookupName(source)) ?? toChineseName(source)
      if (zh) { r.names.zh = zh; r.name = zh }
    }
    if (!r.names['zh-TW'] || isLatin(r.names['zh-TW']) || latinMix(r.names['zh-TW'])) {
      zh ??= toChineseName(lookupName(source)) ?? toChineseName(source)
      if (zh) r.names['zh-TW'] = zh
    }
  }
}

export async function loadAll(onProgress?: (s: string) => void): Promise<Rec[]> {
  const base = `${BASE}data/base/`
  const tasks = FILES.map(async file => {
    const res = await fetch(base + file + '.json')
    if (!res.ok) throw new Error(file)
    return geoToRecs(await res.json(), 'ne', file)
  })
  tasks.push((async () => {
    const res = await fetch(base + 'curated.json')
    if (!res.ok) return []
    const raw = await res.json() as any[]
    return raw.filter(r => r.name && r.lat != null).map((r, i): Rec => {
      const cat: Cat = ['peak', 'range', 'river', 'lake', 'ocean', 'land', 'trail'].includes(r.cat) ? r.cat : 'land'
      return {
        id: `curated:${i}`, name: r.name, nameEn: r.en,
        names: { zh: r.name, en: r.en ?? r.name }, cat, lat: r.lat, lon: r.lon,
        path: Array.isArray(r.path) && r.path.length > 1 ? splitCross(r.path.map(([la, lo]: number[]) => [lo, la])) : undefined,
        rank: r.p, facts: r.facts, desc: r.desc, source: 'curated', updatedAt: new Date().toISOString(),
      }
    })
  })())
  const settled = await Promise.allSettled(tasks)
  const all: Rec[] = []
  settled.forEach(r => { if (r.status === 'fulfilled') all.push(...r.value) })
  // 注入内置地貌描述（已有描述的不覆盖）
  for (const r of all) {
    if (!r.desc && DESCRIPTIONS[r.name]) r.desc = DESCRIPTIONS[r.name]
  }
  applyChineseFallback(all)
  // 同名要素去重：避免错位重复标注。
  // 但线要素同名可能是同一条河的不同河段（如尼罗河上/下游），按首点区分保留，
  // 否则下游段被当重复丢掉 → 河流"断线"。标签层另有按名去重，只显示一个名字。
  const seen = new Map<string, Rec>()
  const deduped: Rec[] = []
  for (const r of all) {
    // 面要素同名很常见（同一气候区多处分布、同一流域多块飞地）→ 用首个顶点区分，避免整类只剩一个
    const asPoint = (v: unknown): [number, number] | null =>
      Array.isArray(v) && typeof v[0] === 'number' && typeof v[1] === 'number' && Number.isFinite(v[0]) && Number.isFinite(v[1])
        ? [v[0], v[1]] : null
    const geomKey = asPoint(r.path?.[0]) ?? asPoint(r.rings?.[0]?.[0])
    const seg = geomKey ? `|${geomKey[0].toFixed(2)},${geomKey[1].toFixed(2)}` : ''
    const k = `${r.name}|${r.cat}${seg}`
    const prev = seen.get(k)
    if (!prev) { seen.set(k, r); deduped.push(r); continue }
    // 同名重复时保留先出现的几何，但把精选的教学描述/事实合并进来（curated 优先于 NE）
    if (!prev.desc && r.desc) prev.desc = r.desc
    if (!prev.facts?.length && r.facts?.length) prev.facts = r.facts
    if (!prev.nameEn && r.nameEn) prev.nameEn = r.nameEn
  }
  onProgress?.(`已加载 ${deduped.length} 个自然地理要素`)
  return deduped
}
