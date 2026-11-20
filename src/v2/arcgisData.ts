import type { Rec } from './data4'
import type { Cat } from './config2'
import { toChineseName } from './geoNames'
import { t } from './i18n2'
import { basinFacts, basinDescription, zhWaterProvince } from './basinFacts'

/**
 * 在线高精度自然地理数据（对标 Google Earth 数据准确性）：
 * 1) 河流：Natural Earth 10m 河道（ArcGIS 托管），真实河径几何 + name_zh 多语言字段。
 *    本地 public/data/base/rivers.json 是被过度简化的版本（黄河仅 2-3 个控制点），
 *    导致"几字弯"等关键河型走样；此模块用服务端 generalization 控制精度拉取真数据。
 * 2) 流域：Global Water Provinces（ESRI），提供流域面几何 + AREAkm2 流域面积。
 *    按视野 bbox 空间查询（实测 ~400ms），避免一次性拉取全球面数据。
 */

const RIVER_URL = 'https://services1.arcgis.com/ZIL9uO234SBBPGL7/arcgis/rest/services/Rivers_World_Natural_Earth/FeatureServer/0/query'
const BASIN_URL = 'https://services5.arcgis.com/7weheFjxuNkGGiZi/arcgis/rest/services/GlobalWaterProvinces_view/FeatureServer/0/query'
/** HydroSHEDS v2 子流域（实验双轨：HYBAS_ID 层级，服务无名称字段）。 */
const HYDRO_URL = 'https://services5.arcgis.com/7weheFjxuNkGGiZi/arcgis/rest/services/Hydrosheds_v2_Basins_view/FeatureServer/0/query'
/** 河道简化容差（度）。0.005°≈550m：黄河几字弯顶点可完整保留（实测 448 控制点）。 */
const RIVER_TOLERANCE = 0.005

/** 重大流域名中译（MAJORBASIN 字段为英文/当地文）。 */
const BASIN_ZH: Record<string, string> = {
  'Huang He': '黄河流域', 'Yangtze': '长江流域', 'Mekong': '湄公河流域',
  'Nile': '尼罗河流域', 'Amur': '黑龙江流域', 'Mississippi - Missouri': '密西西比-密苏里河流域',
  'Congo': '刚果河流域', 'Volga': '伏尔加河流域', 'Ob': '鄂毕河流域', 'Danube': '多瑙河流域',
  'Ganges - Bramaputra': '恒河-布拉马普特拉河流域', 'Indus': '印度河流域',
  'Amazon': '亚马孙河流域', 'La Plata': '拉普拉塔河流域', 'Yenisey': '叶尼塞河流域',
  'Lena': '勒拿河流域', 'Mackenzie': '马更些河流域', 'Niger': '尼日尔河流域',
  'Murray - Darling': '墨累-达令河流域', 'Tarim Interior': '塔里木河内流区',
  'Gobi Interior': '戈壁内流区', 'Lake Chad': '乍得湖流域', 'Orinoco': '奥里诺科河流域',
  'Magdalena': '马格达莱纳河流域', 'Sao Francisco': '圣弗朗西斯科河流域',
  'Tocantins': '托坎廷斯河流域', 'Parana': '巴拉那河流域', 'Uruguay': '乌拉圭河流域',
  'Río Grande - Bravo': '格兰德河流域', 'Columbia and Northwestern United States': '哥伦比亚河流域',
  'Hudson Bay Coast': '哈德逊湾沿岸流域', 'Saskatchewan - Nelson': '萨斯喀彻温-纳尔逊河流域',
  'Churchill': '丘吉尔河流域', 'St Lawrence': '圣劳伦斯河流域', 'Northern Dvina': '北德维纳河流域',
  'Limpopo': '林波波河流域', 'Zambezi': '赞比西河流域', 'Orange': '奥兰治河流域',
  'Senegal': '塞内加尔河流域', 'Volta': '沃尔特河流域', 'Rift Valley': '东非裂谷流域',
  'Shebelli - Juba': '谢贝利-朱巴河流域', 'Sanaga': '萨纳加河流域',
  'Chao Phraya': '湄南河流域', 'Irrawaddy': '伊洛瓦底江流域', 'Salween': '怒江-萨尔温江流域',
  'Sittang': '锡当河流域', 'Hong (Red River)': '红河流域', 'Xun Jiang': '浔江流域',
  'Ziya He, Interior': '子牙河内流区', 'Bo Hai - Korean Bay, North Coast': '渤海-朝鲜湾北岸流域',
  'China Coast': '中国沿岸流域', 'Hainan': '海南岛流域', 'Taiwan': '台湾岛流域',
  'Amu Darya': '阿姆河流域', 'Syr Darya': '锡尔河流域', 'Ural': '乌拉尔河流域',
  'Dnieper': '第聂伯河流域', 'Dniester': '德涅斯特河流域', 'Don': '顿河流域',
  'Ebro': '埃布罗河流域', 'Rhine': '莱茵河流域', 'Rhône': '罗讷河流域',
  'Po': '波河流域', 'Tiber': '台伯河流域', 'Loire': '卢瓦尔河流域',
  'Seine': '塞纳河流域', 'Elbe': '易北河流域', 'Oder': '奥得河流域',
  'Wisla': '维斯瓦河流域', 'Vistula': '维斯瓦河流域', 'Tagus': '塔霍河流域',
  'Douro': '杜罗河流域', 'Guadiana': '瓜迪亚纳河流域', 'Guadalquivir': '瓜达尔基维尔河流域',
  'Ebro Interior': '埃布罗内流区', 'Great Basin': '大盆地内流区',
  'Dead Sea': '死海流域', 'Eastern Jordan - Syria': '约旦-叙利亚东部流域',
  'Tigris - Euphrates': '底格里斯-幼发拉底河流域', 'Helmand': '哈德河流域',
  'Farahrud': '法拉河内流区', 'Central Iran': '伊朗中部内流区',
  'Arabian Peninsula': '阿拉伯半岛流域', 'Persian Gulf Coast': '波斯湾沿岸流域',
  // 沿岸 / 岛屿型水文单元（视野内常见，补齐避免英文混入中文界面）
  'Siberia, North Coast': '西伯利亚北岸流域', 'Siberia, West Coast': '西伯利亚西岸流域',
  'Andaman - Nicobar Islands': '安达曼-尼科巴群岛流域', 'Arabian Sea Coast': '阿拉伯海沿岸流域',
  'Arctic Ocean Islands': '北冰洋岛屿流域', 'Australia, East Coast': '澳大利亚东岸流域',
  'Australia, Interior': '澳大利亚内陆流域', 'Australia, North Coast': '澳大利亚北岸流域',
  'Australia, South Coast': '澳大利亚南岸流域', 'Australia, West Coast': '澳大利亚西岸流域',
  'Bay of Bengal, North East Coast': '孟加拉湾东北岸流域', 'Brahamani': '布拉马尼河流域',
  'Caspian Sea Coast': '里海沿岸流域', 'Caspian Sea, East Coast': '里海东岸流域',
  'Cauvery': '考韦里河流域', 'Fly': '弗莱河流域', 'Gulf of Thailand Coast': '泰国湾沿岸流域',
  'Hamun-i-Mashkel': '哈蒙马什凯尔流域', 'India East Coast': '印度东岸流域',
  'India North East Coast': '印度东北岸流域', 'India South Coast': '印度南岸流域',
  'India West Coast': '印度西岸流域', 'Irian Jaya Coast': '伊里安查亚沿岸流域',
  'Japan': '日本流域', 'Java - Timor': '爪哇-帝汶流域', 'Kalimantan': '加里曼丹流域',
  'Kara Sea Coast': '喀拉海沿岸流域', 'Kiribati - Nauru': '基里巴斯-瑙鲁流域',
  'Lake Balkash': '巴尔喀什湖流域', 'Mahandi': '马哈纳迪河流域', 'Mahi': '马希河流域',
  'Micronesia': '密克罗尼西亚流域', 'New Zealand': '新西兰流域',
  'North and South Korea': '朝鲜半岛流域', 'North Borneo Coast': '北婆罗洲沿岸流域',
  'North Marina Islands and Guam': '北马里亚纳群岛和关岛流域',
  'Palau and East Indonesia': '帕劳与印尼东部流域', 'Papua New Guinea Coast': '巴布亚新几内亚沿岸流域',
  'Peninsula Malaysia': '马来半岛流域', 'Pennar': '彭纳河流域', 'Philippines': '菲律宾流域',
  'Plateau of Tibet Interior': '青藏高原内流区', 'Russia, Barents Sea Coast': '俄罗斯巴伦支海沿岸流域',
  'Russia, South East Coast': '俄罗斯东南沿岸流域', 'Sabarmati': '萨巴尔马蒂河流域',
  'Sepik': '塞皮克河流域', 'Solomon Islands': '所罗门群岛流域',
  'South China Sea Coast': '南海沿岸流域', 'South Pacific Islands': '南太平洋群岛流域',
  'Sri Lanka': '斯里兰卡流域', 'Sulawesi': '苏拉威西流域', 'Sumatra': '苏门答腊流域',
  'Tapti': '塔普蒂河流域', 'Tasmania': '塔斯马尼亚流域', 'Viet Nam, Coast': '越南沿岸流域',
  'Yasai': '亚赛河流域', 'Pacific and Arctic Coast': '太平洋与北冰洋沿岸流域',
}

function zhBasin(name: string): string {
  return BASIN_ZH[name] ?? toChineseName(name) ?? name
}

interface EsriPath { spatialReference?: { wkid?: number }; paths: number[][][] }
interface EsriRing { spatialReference?: { wkid?: number }; rings: number[][][] }

/** 路径分段：跨 180° 经线处切断（避免横穿全球的假线）。 */
function splitPath(pts: number[][]): [number, number][][] {
  const out: [number, number][][] = []
  let seg: [number, number][] = []
  for (const p of pts) {
    if (!Array.isArray(p) || p.length < 2) continue
    const lon = p[0], lat = p[1]
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue
    if (seg.length && Math.abs(lon - seg[seg.length - 1][0]) > 180) {
      if (seg.length > 1) out.push(seg)
      seg = []
    }
    seg.push([lon, lat])
  }
  if (seg.length > 1) out.push(seg)
  return out
}

function centroidOf(rings: [number, number][][]): [number, number] | null {
  if (!rings.length) return null
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0])
  let lon = 0, lat = 0
  for (const p of ring) { lon += p[0]; lat += p[1] }
  return [lon / ring.length, lat / ring.length]
}

/** 环是否有跨 180° 经线的跳变（跨日界线的流域无法在经纬度空间直接闭合，跳过避免画错）。 */
function crossesDateline(ring: number[][]): boolean {
  for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) return true
  return false
}

/** 鞋带公式面积（经纬度平面，仅用于相对大小/方向判定）。 */
function shoelace(ring: [number, number][]): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]
    s += (a[0] * b[1] - b[0] * a[1])
  }
  return s / 2
}

/** 射线法：点是否在环内。 */
export function pointInRing(p: [number, number], ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j]
    if ((a[1] > p[1]) !== (b[1] > p[1]) &&
      p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1] || 1e-12) + a[0]) inside = !inside
  }
  return inside
}

/**
 * 拉取 Natural Earth 10m 高精度河道（含中文名），返回 Rec[]（cat=river）。
 * 失败返回 null，由调用方回退到本地简化数据。
 */
export async function fetchPrecisionRivers(signal?: AbortSignal): Promise<Rec[] | null> {
  try {
    const params = new URLSearchParams({
      f: 'json', where: '1=1',
      outFields: 'name,name_zh,name_en,scalerank',
      returnGeometry: 'true', outSR: '4326',
      resultRecordCount: '2000',
      maxAllowableOffset: String(RIVER_TOLERANCE),
    })
    const res = await fetch(`${RIVER_URL}?${params}`, { signal })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error || !Array.isArray(json?.features)) return null
    const updatedAt = new Date().toISOString()
    const out: Rec[] = []
    for (const f of json.features) {
      const a = f.attributes ?? {}
      const geom = f.geometry as EsriPath | undefined
      if (!geom?.paths?.length) continue
      const en = String(a.name_en ?? a.name ?? '').trim()
      const rawZh = String(a.name_zh ?? '').trim()
      const zh = /[一-鿿]/.test(rawZh) ? rawZh : toChineseName(en)
      const name = zh || en
      if (!name) continue
      const rings: [number, number][][] = []
      for (const path of geom.paths) rings.push(...splitPath(path))
      if (!rings.length) continue
      // 同一条河可能被切成多段（黄河上/下游）：按最长段做锚点，其余段以同名 rec 保留
      const anchor = centroidOf(rings)
      if (!anchor) continue
      const rank = typeof a.scalerank === 'number' ? a.scalerank : undefined
      // 每个独立河段单独成 rec，保证几何完整（去重逻辑按首点区分，不会互相吞掉）
      for (const seg of rings) {
        if (seg.length < 2) continue
        let slon = 0, slat = 0
        for (const p of seg) { slon += p[0]; slat += p[1] }
        const rec: Rec = {
          id: `ne10:${en}:${slon.toFixed(2)},${slat.toFixed(2)}`,
          name, nameEn: en && en !== name ? en : undefined,
          names: { zh: name, 'zh-TW': name, en },
          cat: 'river' as Cat,
          lat: slat / seg.length, lon: slon / seg.length,
          path: seg, rank, source: 'ne10', updatedAt,
        }
        out.push(rec)
      }
    }
    return out.length ? out : null
  } catch {
    return null
  }
}

export interface BasinHit {
  name: string      // 原始流域名
  zh: string        // 中文名
  areaKm2: number   // 流域总面积（同名多边形求和）
  subName?: string  // 所在子流域（WaterProvince）
  country?: string
}

/**
 * 点查所在流域 + 汇总流域面积（两次轻量请求，均带统计）。
 * 用于"点击河流 → 详情显示流域范围与面积"。
 */
export async function queryBasinAt(lon: number, lat: number, signal?: AbortSignal): Promise<BasinHit | null> {
  try {
    const geom = JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } })
    const p1 = new URLSearchParams({
      f: 'json', geometry: geom, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'MAJORBASIN,WaterProvince,COUNTRY', returnGeometry: 'false', resultRecordCount: '5',
    })
    const r1 = await fetch(`${BASIN_URL}?${p1}`, { signal })
    const j1 = await r1.json()
    const attrs = j1?.features?.[0]?.attributes ?? {}
    const hit = attrs.MAJORBASIN
    if (!hit) return null
    // 汇总该流域总面积（服务端统计不支持 → where 拉属性客户端求和，实测 ~300ms）
    const p2 = new URLSearchParams({
      f: 'json', where: `MAJORBASIN='${String(hit).replace(/'/g, "''")}'`,
      outFields: 'AREAkm2', returnGeometry: 'false', resultRecordCount: '200',
    })
    const r2 = await fetch(`${BASIN_URL}?${p2}`, { signal })
    const j2 = await r2.json()
    let area = 0
    for (const f of j2?.features ?? []) area += Number(f.attributes?.AREAkm2) || 0
    return {
      name: String(hit), zh: zhBasin(String(hit)), areaKm2: area,
      subName: attrs.WaterProvince ? zhWaterProvince(String(attrs.WaterProvince), String(attrs.COUNTRY ?? '')) : undefined,
      country: attrs.COUNTRY ? String(attrs.COUNTRY) : undefined,
    }
  } catch {
    return null
  }
}

/**
 * 拉取视野内的流域面（含面积）。bbox = [west, south, east, north]。
 * maxAllowableOffset 随视野放大而放宽，控制返回体积。
 */
export async function fetchBasinsInView(
  west: number, south: number, east: number, north: number, signal?: AbortSignal,
): Promise<Rec[] | null> {
  try {
    const span = Math.max(east - west, north - south)
    const tol = Math.max(0.01, Math.min(0.5, span / 60))
    const env = JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } })
    const params = new URLSearchParams({
      f: 'json', geometry: env, geometryType: 'esriGeometryEnvelope',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'MAJORBASIN,AREAkm2,REGION,COUNTRY,WaterProvince,watprovID',
      returnGeometry: 'true', outSR: '4326',
      resultRecordCount: '500', maxAllowableOffset: String(tol),
    })
    const res = await fetch(`${BASIN_URL}?${params}`, { signal })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error || !Array.isArray(json?.features)) return null
    const updatedAt = new Date().toISOString()
    interface Entry {
      rings: [number, number][][]; holes: [number, number][][]; area: number
      region: string; country: string; parent: string; raw: string
    }
    const majors = new Map<string, Entry>()
    const subs = new Map<string, Entry>()
    const entry = (): Entry => ({ rings: [], holes: [], area: 0, region: '', country: '', parent: '', raw: '' })
    for (const f of json.features) {
      const a = f.attributes ?? {}
      const geom = f.geometry as EsriRing | undefined
      if (!geom?.rings?.length) continue
      const major = String(a.MAJORBASIN ?? '')
      const province = String(a.WaterProvince ?? '')
      if (!major) continue
      // 每个 Esri polygon：按面积降序识别外环与内洞（被包含者为洞）
      const parts = geom.rings
        .filter(r => Array.isArray(r) && r.length >= 4 && !crossesDateline(r))
        .map(r => {
          const pts = r.map(p => [p[0], p[1]] as [number, number])
          return { pts, area: Math.abs(shoelace(pts)) }
        })
        .sort((x, y) => y.area - x.area)
      const add = (e: Entry): void => {
        const outers: [number, number][][] = []
        for (const p of parts) {
          if (outers.some(o => pointInRing(p.pts[0], o))) e.holes.push(p.pts)
          else { outers.push(p.pts); e.rings.push(p.pts) }
        }
        e.area += Number(a.AREAkm2) || 0
        e.region = String(a.REGION ?? e.region)
        e.country = String(a.COUNTRY ?? e.country)
        e.parent = major
        e.raw = province || major
      }
      const me = majors.get(major) ?? entry(); add(me); majors.set(major, me)
      if (province) { const se = subs.get(province) ?? entry(); add(se); subs.set(province, se) }
    }
    const out: Rec[] = []
    const toRec = (key: string, e: Entry, cat: 'basin' | 'subbasin'): Rec | null => {
      if (!e.rings.length) return null
      const anchor = centroidOf(e.rings)
      if (!anchor) return null
      const zh = cat === 'basin' ? zhBasin(key)
        : `${zhWaterProvince(e.raw, e.country, e.region)}子流域`
      const parentZh = zhBasin(e.parent)
      const parent = majors.get(e.parent)
      const children = [...subs.entries()].filter(([, x]) => x.parent === key)
        .sort((x, y) => y[1].area - x[1].area)
      const childFacts: [string, string][] = cat === 'basin' && children.length
        ? [[t('subbasin'), `共 ${children.length} 个：` + children.slice(0, 6)
          .map(([k, x]) => `${zhWaterProvince(k, x.country, x.region)} ${Math.round(x.area).toLocaleString('zh-CN')} km²`).join('、') + '…']]
        : []
      const sorted = [...subs.entries()].filter(([, x]) => x.parent === e.parent)
        .sort((x, y) => y[1].area - x[1].area)
      const rank = sorted.findIndex(([k]) => k === key) + 1
      return {
        id: `${cat}:${key}`, name: zh, nameEn: key,
        names: { zh, 'zh-TW': zh, en: key },
        cat, lat: anchor[1], lon: anchor[0], rings: e.rings, holes: e.holes,
        parent: cat === 'subbasin' ? parentZh : undefined,
        colorIndex: cat === 'subbasin' ? rank - 1 : undefined,
        colorTotal: cat === 'subbasin' ? sorted.length : undefined,
        facts: [...childFacts, ...basinFacts(cat === 'basin' ? zh : `${zh}子流域`, {
          areaKm2: e.area, parentAreaKm2: parent?.area, rank, total: sorted.length,
          country: e.country, parentName: cat === 'subbasin' ? parentZh : undefined,
          isSub: cat === 'subbasin',
        })],
        desc: cat === 'basin' ? basinDescription(zh,
          `按 Global Water Provinces 数据汇总，面积约 ${Math.round(e.area).toLocaleString('zh-CN')} km²，包含 ${sorted.length} 个省级子流域。`)
          : `${parentZh}内的子流域，按全球水文分区资料划定的省级集水区。`,
        source: 'gwvp', updatedAt,
      }
    }
    for (const [key, e] of majors) { const r = toRec(key, e, 'basin'); if (r) out.push(r) }
    for (const [key, e] of subs) { const r = toRec(key, e, 'subbasin'); if (r) out.push(r) }
    return out.length ? out : null
  } catch {
    return null
  }
}

/**
 * HydroSHEDS v2 子流域实验查询（HYBAS_ID 层级 / UPSTREAM_ACC 上游累计面积）。
 * 该服务按视野 bbox 可能返回空结果；失败或为空时返回 null，由调用方保留 WaterProvince 子流域。
 */
export async function fetchHydroBasinsInView(
  west: number, south: number, east: number, north: number, signal?: AbortSignal,
): Promise<Rec[] | null> {
  try {
    const env = JSON.stringify({ xmin: west, ymin: south, xmax: east, ymax: north, spatialReference: { wkid: 4326 } })
    const params = new URLSearchParams({
      f: 'json', geometry: env, geometryType: 'esriGeometryEnvelope',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'HYBAS_ID,UPSTREAM_ACC,UPLAND_SKM,MAIN_BAS',
      returnGeometry: 'true', outSR: '4326', resultRecordCount: '500',
      maxAllowableOffset: '0.05',
    })
    const res = await fetch(`${HYDRO_URL}?${params}`, { signal })
    if (!res.ok) return null
    const json = await res.json()
    if (json?.error || !Array.isArray(json?.features) || !json.features.length) return null
    const updatedAt = new Date().toISOString()
    const out: Rec[] = []
    for (const f of json.features) {
      const a = f.attributes ?? {}
      const geom = f.geometry as EsriRing | undefined
      if (!geom?.rings?.length) continue
      const id = String(a.HYBAS_ID ?? '')
      if (!id) continue
      const rings: [number, number][][] = geom.rings
        .filter(r => Array.isArray(r) && r.length >= 4 && !crossesDateline(r))
        .map(r => r.map(p => [p[0], p[1]] as [number, number]))
      const anchor = centroidOf(rings)
      if (!anchor) continue
      const area = Number(a.UPLAND_SKM) || 0
      const upstream = Number(a.UPSTREAM_ACC) || 0
      out.push({
        id: `hydro:${id}`, name: `子流域 ${id}`, nameEn: `HYBAS_ID ${id}`,
        names: { zh: `子流域 ${id}`, 'zh-TW': `子流域 ${id}`, en: `HYBAS_ID ${id}` },
        cat: 'subbasin', lat: anchor[1], lon: anchor[0], rings,
        facts: [
          [t('basinArea'), `${Math.round(area).toLocaleString('zh-CN')} km²`],
          ['上游累计面积', `${Math.round(upstream).toLocaleString('zh-CN')} km²`],
        ],
        desc: `HydroSHEDS v2 流域单元（编号 ${id}），为本级集水区面；上游累计面积包含其全部上游子流域。`,
        source: 'hydrosheds', updatedAt,
      })
    }
    return out.length ? out : null
  } catch {
    return null
  }
}
