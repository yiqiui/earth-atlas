export type Lang = 'zh' | 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'ru' | 'de' | 'es' | 'pt' | 'la' | 'ar' | 'it'

export const LANGS: { code: Lang; native: string }[] = [
  { code: 'zh', native: '简体中文' }, { code: 'zh-TW', native: '繁體中文' },
  { code: 'en', native: 'English' }, { code: 'ja', native: '日本語' },
  { code: 'ko', native: '한국어' }, { code: 'fr', native: 'Français' },
  { code: 'ru', native: 'Русский' }, { code: 'de', native: 'Deutsch' },
  { code: 'es', native: 'Español' }, { code: 'pt', native: 'Português' },
  { code: 'la', native: 'Latina' }, { code: 'ar', native: 'العربية' },
  { code: 'it', native: 'Italiano' },
]

type Dict = Record<string, string>
const EN: Dict = {
  subtitle: 'GLOBAL LANDFORM ATLAS · 3D', cats: 'Mountains · Rivers · Lakes · Oceans · Land · Islands',
  search: 'Search mountains / rivers / bays…', layers: 'Natural layers', view: 'View',
  relief: 'Terrain relief', satellite: 'Satellite imagery', reliefH: 'Hypsometric tint',
  clouds: 'Clouds', grid: 'Graticule', exaggeration: 'Relief ×', reset: 'Reset view',
  online: 'Online', standby: 'Standby', querying: 'Querying…', cached: 'Cached', offline: 'Offline',
  src: 'Source', features: 'features', coord: 'Coordinates', elevation: 'Elevation', length: 'Length',
  climate: 'Climate', noDesc: 'No description.', note: 'Natural landforms only · schematic layers for teaching',
  peak: 'Peaks', range: 'Ranges', river: 'Rivers', lake: 'Lakes', ocean: 'Oceans', land: 'Landforms',
  island: 'Islands', bay: 'Bays', gulf: 'Gulfs', strait: 'Straits', cape: 'Capes', trail: 'Trails',
  current: 'Currents', fjord: 'Fjords', biome: 'Grassland',
  basin: 'River basins', basinArea: 'Basin area', basinName: 'Basin',
  subbasin: 'Sub-basins', swamp: 'Wetlands',
  basinShare: 'Share of parent basin', basinRank: 'Area rank', basinDischarge: 'Annual runoff',
  basinClimate: 'Climate zone', basinCountry: 'Country / region', basinRange: 'Extent',
  noDischarge: 'No authoritative online discharge data; area and climate zone shown instead',
  estimate: 'Teaching reference value', coordSearch: 'Go to coordinates', cat: 'Category',
  nearby: 'Nearby features',
}

const D: Partial<Record<Lang, Dict>> = {
  zh: {
    subtitle: '全球地貌图谱 · 三维', cats: '山川 · 河流 · 湖泊 · 海洋 · 陆地 · 岛屿',
    search: '搜索：山脉 / 河流 / 海湾 / 岛屿…', layers: '自然地貌图层', view: '视图',
    relief: '地形浮雕', satellite: '卫星影像', reliefH: '分层设色', clouds: '云层', grid: '经纬网',
    exaggeration: '地形夸张', reset: '重置视角', online: '在线', standby: '待命', querying: '查询中…',
    cached: '缓存', offline: '离线', src: '来源', features: '个要素', coord: '坐标', elevation: '海拔',
    length: '长度', climate: '气候', noDesc: '暂无描述。', note: '仅展示自然地貌 · 专题图层为教学示意',
    peak: '山峰', range: '山脉', river: '河流', lake: '湖泊', ocean: '海洋', land: '陆地地貌',
    island: '岛屿', bay: '海湾', gulf: '海湾', strait: '海峡', cape: '海角', trail: '步道',
    current: '洋流', fjord: '峡湾', biome: '草原',
    basin: '流域', basinArea: '流域面积', basinName: '所属流域',
    subbasin: '子流域', swamp: '沼泽湿地',
    basinShare: '占父流域比例', basinRank: '面积排名', basinDischarge: '年径流量',
    basinClimate: '气候带', basinCountry: '国家/地区', basinRange: '范围',
    noDischarge: '暂无权威在线流量数据，仅展示面积与气候带',
    estimate: '教学参考值', coordSearch: '跳转到经纬度', cat: '类别', nearby: '附近地貌',
  },
  'zh-TW': {
    subtitle: '全球地貌圖譜 · 三維', cats: '山川 · 河流 · 湖泊 · 海洋 · 陸地 · 島嶼',
    search: '搜尋：山脈 / 河流 / 海灣 / 島嶼…', layers: '自然地貌圖層', view: '視圖',
    relief: '地形浮雕', satellite: '衛星影像', reliefH: '分層設色', clouds: '雲層', grid: '經緯網',
    exaggeration: '地形誇張', reset: '重置視角', online: '線上', standby: '待命', querying: '查詢中…',
    cached: '快取', offline: '離線', src: '來源', features: '個要素', coord: '座標', elevation: '海拔',
    length: '長度', climate: '氣候', noDesc: '暫無描述。', note: '僅展示自然地貌 · 專題圖層為教學示意',
    peak: '山峰', range: '山脈', river: '河流', lake: '湖泊', ocean: '海洋', land: '陸地地貌',
    island: '島嶼', bay: '海灣', gulf: '海灣', strait: '海峽', cape: '海角', trail: '步道',
    current: '洋流', fjord: '峽灣', biome: '草原',
    basin: '流域', basinArea: '流域面積', basinName: '所屬流域',
    subbasin: '子流域', swamp: '沼澤濕地',
    basinShare: '佔母流域比例', basinRank: '面積排名', basinDischarge: '年徑流量',
    basinClimate: '氣候帶', basinCountry: '國家/地區', basinRange: '範圍',
    noDischarge: '暫無權威線上流量資料，僅展示面積與氣候帶',
    estimate: '教學參考值', coordSearch: '跳轉至經緯度', cat: '類別', nearby: '附近地貌',
  },
  ja: { subtitle: '世界地形図鑑 · 3D', search: '検索：山脈 / 河川 / 湾…', layers: '自然地形レイヤー', relief: '地形起伏', satellite: '衛星影像', features: '件', peak: '山峰', range: '山脈', river: '河川', lake: '湖', ocean: '海洋', land: '地形', island: '島', bay: '湾', gulf: '大湾', strait: '海峡' },
  ko: { subtitle: '세계 지형 도감 · 3D', search: '검색: 산맥 / 하천 / 만…', layers: '자연 지형 레이어', relief: '지형 기복', satellite: '위성 영상', features: '개', peak: '봉우리', range: '산맥', river: '하천', lake: '호수', ocean: '해양', land: '지형', island: '섬', bay: '만', gulf: '대만', strait: '해협' },
  fr: { subtitle: 'ATLAS DU RELIEF · 3D', search: 'Rechercher…', layers: 'Couches naturelles', relief: 'Relief', satellite: 'Image satellite', features: 'éléments' },
  ru: { subtitle: 'АТЛАС РЕЛЬЕФА · 3D', search: 'Поиск…', layers: 'Природные слои', relief: 'Рельеф', satellite: 'Спутник', features: 'объектов' },
  de: { subtitle: 'RELIEFATLAS · 3D', search: 'Suche…', layers: 'Natürliche Ebenen', relief: 'Relief', satellite: 'Satellit', features: 'Objekte' },
  es: { subtitle: 'ATLAS DEL RELIEVE · 3D', search: 'Buscar…', layers: 'Capas naturales', relief: 'Relieve', satellite: 'Satélite', features: 'elementos' },
  pt: { subtitle: 'ATLAS DO RELEVO · 3D', search: 'Pesquisar…', layers: 'Camadas naturais', relief: 'Relevo', satellite: 'Satélite', features: 'elementos' },
  la: { subtitle: 'ATLAS RELIEFUS · 3D', search: 'Quaerere…', layers: 'Strata naturalia', relief: 'Reliefus', satellite: 'Imago satellitis', features: 'elementa' },
  ar: { subtitle: 'أطلس التضاريس · ٣D', search: 'بحث…', layers: 'الطبقات الطبيعية', relief: 'التضاريس', satellite: 'القمر الصناعي', features: 'عنصر' },
  it: { subtitle: 'ATLANTE DEL RILIEVO · 3D', search: 'Cerca…', layers: 'Livelli naturali', relief: 'Rilievo', satellite: 'Satellite', features: 'elementi' },
}

const store = {
  get(k: string) { try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null } catch { return null } },
  set(k: string, v: string) { try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v) } catch {} },
}

let current: Lang = (() => {
  const s = store.get('earth-atlas:v2:lang') as Lang | null
  return s && LANGS.some(l => l.code === s) ? s : 'zh'
})()
export const lang = () => current
export function setLanguage(l: Lang) { if (LANGS.some(x => x.code === l)) { current = l; store.set('earth-atlas:v2:lang', l) } }

/** 分类名：优先本地字典，缺失回退英文。 */
export function catLabel(cat: string): string {
  return D[current]?.[cat] ?? EN[cat] ?? cat
}
export function t(key: string): string {
  return D[current]?.[key] ?? EN[key] ?? key
}
