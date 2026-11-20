/** v2 常量（含 clamp），绕开旧缓存。 */
// 4K UHD 级地表纹理：7680×3840（20:10 等距柱状），放大更清晰。
export const W = 7680
export const H = 3840
export const EARTH_R = 1
export const D2R = Math.PI / 180
export const R2D = 180 / Math.PI
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const BASE = (import.meta.env.BASE_URL || '/')

export type Cat =
  | 'peak' | 'range' | 'river' | 'lake' | 'ocean' | 'land' | 'island'
  | 'bay' | 'gulf' | 'strait' | 'cape' | 'trail' | 'current' | 'fjord'
  | 'climate' | 'biome' | 'basin' | 'subbasin' | 'swamp'

export const DEFAULT_LAYERS: Cat[] = [
  'peak', 'range', 'river', 'lake', 'land', 'island', 'ocean', 'bay', 'gulf', 'strait',
]
export const ALL_LAYERS: Cat[] = [
  ...DEFAULT_LAYERS, 'cape', 'trail', 'current', 'fjord', 'climate', 'biome',
  'basin', 'subbasin', 'swamp',
]

/** 语义化配色：水系按类型分散到蓝/青/紫，陆地暖色，专题色各自独立，避免同类蓝糊成一片。 */
export const CAT_COLOR: Record<Cat, string> = {
  peak: '#ffe0a3', range: '#e08a3c', river: '#1aa7e8', lake: '#18a8a0', ocean: '#2d5a7a',
  land: '#c8b06a', island: '#9dbf5a', bay: '#3f8ab0', gulf: '#5a6aa8', strait: '#b9903a',
  cape: '#e6c68a', trail: '#e2543c', current: '#f07a4f', fjord: '#2a8fb0',
  climate: '#78b85a', biome: '#b9c46b', basin: '#8fd0a0',
  subbasin: '#d98c3c', swamp: '#6aa84f',
}

/** 需要绘制面域（填充 + 边界）的类别。专题图层亦在此列。 */
export const AREA_CATS: Cat[] = [
  'gulf', 'bay', 'ocean', 'lake', 'basin', 'subbasin', 'climate', 'biome', 'swamp',
]

/** 教学气候分区配色（Köppen 归类），相邻色相拉开避免混淆。 */
export const ZONE_COLOR: Record<string, string> = {
  'tropical-rainforest': '#2fa66a', 'tropical-monsoon': '#67c25d',
  'tropical-savanna': '#b6c94e', 'tropical-desert': '#e2b65b',
  'temperate-desert': '#d9c07a',
  'subtropical': '#d68f5a', 'mediterranean': '#d9757b',
  'temperate-maritime': '#69a8d8', 'temperate-monsoon': '#7d7fd0',
  'temperate-continental': '#b07fc4', 'boreal': '#8f9ad6',
  'plateau-mountain': '#a2a59f', 'polar': '#c9d7e8',
}
/** 植被 / 草原分区配色。 */
export const BIOME_COLOR: Record<string, string> = {
  'temperate-grassland': '#c3c85a', 'tropical-savanna': '#d3a94c',
  'temperate-forest': '#5aa56a', 'coniferous-forest': '#3f7f6c',
  'wetland': '#7fa85c',
}

export const CAT_MIN_DIST: Record<Cat, number> = {
  ocean: 9, land: 8, range: 9, river: 8, lake: 8, gulf: 8, bay: 8,
  island: 6, strait: 6, peak: 5, cape: 5, fjord: 5,
  current: 5, climate: 5, biome: 5, trail: 4, basin: 7,
  subbasin: 6, swamp: 5,
}
