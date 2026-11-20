import { BIOME_COLOR, CAT_COLOR, ZONE_COLOR, type Cat } from './config2'

/** 稳定字符串哈希（FNV-1a 变体）：同一要素每次刷新颜色一致。 */
export function hashOf(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0)
}

export function hslHex(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const c = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${c(f(0))}${c(f(8))}${c(f(4))}`
}

/** 大流域：名称哈希 → 金色角相位分布，保证相邻要素大概率异色。 */
export function basinColor(name: string): string {
  const hue = (hashOf(name) * 0.6180339887 % 1) * 360
  return hslHex(hue, 0.58, 0.60)
}

/** 子流域：在父流域色相附近按序展开，既能看出从属关系又互不相同。 */
export function subbasinColor(name: string, parent: string, index: number, total: number): string {
  const base = (hashOf(parent) * 0.6180339887 % 1) * 360
  const step = total > 1 ? index / (total - 1) - 0.5 : 0
  const hue = (base + step * 70 + (total > 8 ? hashOf(name) % 7 : 0) + 360) % 360
  return hslHex(hue, 0.62, 0.64)
}

export interface ColorRec {
  cat: Cat
  name: string
  zone?: string
  parent?: string
  colorIndex?: number
  colorTotal?: number
}

/** 面要素最终取色：流域分色、子流域从属分色、气候/植被按类型分色，其余保留类色。 */
export function areaColor(r: ColorRec): string {
  switch (r.cat) {
    case 'basin': return basinColor(r.name)
    case 'subbasin': return subbasinColor(r.name, r.parent ?? '', r.colorIndex ?? 0, r.colorTotal ?? 1)
    case 'climate': return ZONE_COLOR[r.zone ?? ''] ?? CAT_COLOR.climate
    case 'biome': return BIOME_COLOR[r.zone ?? ''] ?? CAT_COLOR.biome
    case 'swamp': return BIOME_COLOR.wetland
    default: return CAT_COLOR[r.cat]
  }
}

/** 气候/植被类型中文名（详情面板与 tooltip 用）。 */
export const ZONE_ZH: Record<string, string> = {
  'tropical-rainforest': '热带雨林气候', 'tropical-monsoon': '热带季风气候',
  'tropical-savanna': '热带草原气候', 'tropical-desert': '热带沙漠气候',
  'temperate-desert': '温带沙漠与草原气候',
  'subtropical': '亚热带季风与湿润气候', 'mediterranean': '地中海气候',
  'temperate-maritime': '温带海洋性气候', 'temperate-monsoon': '温带季风气候',
  'temperate-continental': '温带大陆性气候', 'boreal': '亚寒带针叶林气候',
  'plateau-mountain': '高原山地气候', 'polar': '寒带气候',
  'temperate-grassland': '温带草原', 'temperate-forest': '温带落叶阔叶林',
  'coniferous-forest': '亚寒带针叶林', 'wetland': '沼泽湿地',
}

export function zoneZh(zone?: string): string { return (zone && ZONE_ZH[zone]) || zone || '' }
