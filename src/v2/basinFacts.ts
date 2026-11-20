import { toChineseName } from './geoNames'
import { t } from './i18n2'
import { zoneZh } from './palette'

/** 精选大流域教学资料：流量为课本/权威机构公开参考值，非在线实测。 */
export interface BasinKnowledge {
  runoff?: string        // 年径流量（参考值）
  length?: string
  climate?: string       // 主要气候带
  desc?: string
}

export const BASIN_KNOWLEDGE: Record<string, BasinKnowledge> = {
  '长江流域': {
    runoff: '约 9,600 亿 m³/年', length: '约 6,300 km', climate: '亚热带季风气候、高原山地气候',
    desc: '中国第一大河，发源于唐古拉山脉，流经 11 个省级行政区注入东海。流域面积约 180 万 km²，水量居亚洲首位。上游峡谷水能丰富，中下游江阔水深，是著名的“黄金水道”。主要支流有雅砻江、岷江、嘉陵江、乌江、湘江、汉江、赣江。',
  },
  '黄河流域': {
    runoff: '约 660 亿 m³/年', length: '约 5,464 km', climate: '温带大陆性气候、温带季风气候',
    desc: '中国第二长河，发源于巴颜喀拉山，流经青藏高原、内蒙古高原、黄土高原，在下游形成“地上河”后注入渤海。含沙量居世界大河之首，是中华文明的主要发源地。主要支流有洮河、湟水、渭河、汾河。',
  },
  '珠江流域': {
    runoff: '约 3,360 亿 m³/年', length: '约 2,320 km', climate: '亚热带季风气候、热带季风气候',
    desc: '中国南方最大水系，由西江、北江、东江及珠江三角洲组成，水量丰沛，航运发达。',
  },
  '黑龙江流域': {
    runoff: '约 3,400 亿 m³/年', length: '约 4,400 km', climate: '温带季风气候、亚寒带针叶林气候',
    desc: '中俄界河，流域跨中国、俄罗斯、蒙古，森林与湿地广布，水量丰富。',
  },
  '湄公河流域': {
    runoff: '约 4,750 亿 m³/年', length: '约 4,900 km', climate: '热带季风气候、高原山地气候',
    desc: '东南亚最重要的国际河流，中国境内称澜沧江，流经六国注入南海，河口三角洲是越南粮仓。',
  },
  '恒河-布拉马普特拉河流域': {
    runoff: '约 1.3 万亿 m³/年', length: '约 2,500 km', climate: '热带季风气候、高原山地气候',
    desc: '南亚最大水系，恒河与布拉马普特拉河在孟加拉国汇合，形成世界最大的河口三角洲。',
  },
  '亚马孙河流域': {
    runoff: '约 6.9 万亿 m³/年', length: '约 6,400 km', climate: '热带雨林气候',
    desc: '世界流量最大、流域面积最广的河流，潮流可上溯数百公里，孕育全球最大的热带雨林。',
  },
  '尼罗河流域': {
    runoff: '约 840 亿 m³/年', length: '约 6,670 km', climate: '热带草原气候、热带沙漠气候',
    desc: '世界最长河流之一，发源于东非高原，流经撒哈拉沙漠注入地中海，是古埃及文明的摇篮。',
  },
  '密西西比-密苏里河流域': {
    runoff: '约 5,800 亿 m³/年', length: '约 6,260 km', climate: '温带大陆性气候、亚热带湿润气候',
    desc: '北美洲最大水系，流经美国中部大平原，是世界著名粮食产区与内河航运干线。',
  },
  '刚果河流域': {
    runoff: '约 4.1 万亿 m³/年', length: '约 4,700 km', climate: '热带雨林气候',
    desc: '非洲流量最大的河流，两次穿过赤道，水能资源极为丰富。',
  },
  '伏尔加河流域': {
    runoff: '约 2,540 亿 m³/年', length: '约 3,530 km', climate: '温带大陆性气候、亚寒带针叶林气候',
    desc: '欧洲最长河流，注入里海，被称为俄罗斯的“母亲河”，航运与灌溉价值高。',
  },
  '多瑙河流域': {
    runoff: '约 2,030 亿 m³/年', length: '约 2,850 km', climate: '温带大陆性气候、地中海气候',
    desc: '流经国家最多的国际河流，自德国黑森林东流注入黑海，是重要的国际航运水道。',
  },
}

/** 国家 / 地区中文译名（WaterProvince 字段拆词后使用）。 */
const REGION_ZH: Record<string, string> = {
  china: '中国', 'united states': '美国', usa: '美国', canada: '加拿大',
  russia: '俄罗斯', 'russian federation': '俄罗斯', mongolia: '蒙古',
  india: '印度', pakistan: '巴基斯坦', bangladesh: '孟加拉国', nepal: '尼泊尔',
  brazil: '巴西', argentina: '阿根廷', peru: '秘鲁', colombia: '哥伦比亚',
  venezuela: '委内瑞拉', bolivia: '玻利维亚', chile: '智利', paraguay: '巴拉圭',
  egypt: '埃及', sudan: '苏丹', 'south sudan': '南苏丹', nigeria: '尼日利亚',
  'united arab emirates': '阿联酋', 'saudi arabia': '沙特阿拉伯',
  turkey: '土耳其', syria: '叙利亚', jordan: '约旦', israel: '以色列',
  australia: '澳大利亚', 'new zealand': '新西兰',
  france: '法国', germany: '德国', spain: '西班牙', italy: '意大利', poland: '波兰',
  'united kingdom': '英国', ukraine: '乌克兰', romania: '罗马尼亚',
  kazakhstan: '哈萨克斯坦', uzbekistan: '乌兹别克斯坦', iran: '伊朗', iraq: '伊拉克',
  tajikistan: '塔吉克斯坦', kyrgyzstan: '吉尔吉斯斯坦', turkmenistan: '土库曼斯坦',
  afghanistan: '阿富汗', myanmar: '缅甸', thailand: '泰国', laos: '老挝',
  vietnam: '越南', 'viet nam': '越南', cambodia: '柬埔寨', malaysia: '马来西亚',
  indonesia: '印度尼西亚', philippines: '菲律宾', japan: '日本', 'south korea': '韩国',
  'north korea': '朝鲜', ethiopia: '埃塞俄比亚', kenya: '肯尼亚',
  'democratic republic of the congo': '刚果（金）', congo: '刚果',
  angola: '安哥拉', zambia: '赞比亚', zimbabwe: '津巴布韦', tanzania: '坦桑尼亚',
  morocco: '摩洛哥', algeria: '阿尔及利亚', tunisia: '突尼斯', libya: '利比亚',
  mexico: '墨西哥', guatemala: '危地马拉', cuba: '古巴',
  anhui: '安徽', beijing: '北京', chongqing: '重庆', gansu: '甘肃', guangdong: '广东',
  guangxi: '广西', guizhou: '贵州', hainan: '海南', hebei: '河北', heilongjiang: '黑龙江',
  henan: '河南', hubei: '湖北', hunan: '湖南', jiangsu: '江苏', jiangxi: '江西',
  jilin: '吉林', liaoning: '辽宁', neimenggu: '内蒙古', ningxia: '宁夏', qinghai: '青海',
  shaanxi: '陕西', shandong: '山东', shanghai: '上海', shanxi: '山西', sichuan: '四川',
  tianjin: '天津', xinjiang: '新疆', xizang: '西藏', tibet: '西藏', yunnan: '云南', zhejiang: '浙江',
}

function zhToken(token: string): string {
  const key = token.trim().toLowerCase()
  const zh = REGION_ZH[key] ?? toChineseName(token) ?? ''
  // 未收录且译名库无法翻译的拉丁词不进入中文界面
  return /[一-鿿]/.test(zh) ? zh : ''
}

/** WaterProvince = 国家 + 大区 + 大流域，转成中文短名，例如「中国四川·长江流域」。 */
export function zhWaterProvince(raw: string, country?: string, region?: string): string {
  const parts = raw.split(/\s+/).filter(Boolean)
  const left = parts.slice(0, Math.max(0, parts.length - 1)).map(zhToken).filter(Boolean)
  const regionZh = region ? zhToken(region) : ''
  const countryZh = country ? zhToken(country) : ''
  // 国家 + 大区已足够定位；不拼接末尾的流域名（否则出现「中国四川黄河子流域」）
  const key = [...new Set([countryZh, regionZh].filter(Boolean))].join('')
    || [...new Set(left)].join('')
    || zhToken(raw)
  return key || '子流域'
}

export interface BasinFactOptions {
  areaKm2: number
  parentAreaKm2?: number
  rank?: number
  total?: number
  country?: string
  climate?: string
  parentName?: string
  isSub?: boolean
}

/** 详情面板统一 facts：面积、占比、排名、国家地区、气候带、精选流量（无数据时明确注明）。 */
export function basinFacts(zhName: string, opt: BasinFactOptions): [string, string][] {
  const facts: [string, string][] = []
  facts.push([t('basinArea'), `${Math.round(opt.areaKm2).toLocaleString('zh-CN')} km²`])
  if (opt.isSub && opt.parentAreaKm2 && opt.parentAreaKm2 > 0) {
    facts.push([t('basinShare'), `${(opt.areaKm2 / opt.parentAreaKm2 * 100).toFixed(1)}%`])
    if (opt.rank && opt.total) facts.push([t('basinRank'), `第 ${opt.rank} / ${opt.total} 位`])
  }
  if (opt.country) facts.push([t('basinCountry'), zhToken(opt.country) || '其他地区'])
  const k = BASIN_KNOWLEDGE[zhName]
  const parentK = opt.parentName ? BASIN_KNOWLEDGE[opt.parentName] : undefined
  const climate = opt.climate || k?.climate || parentK?.climate
  if (climate) facts.push([t('basinClimate'), climate])
  if (!opt.isSub && k?.runoff) {
    facts.push([t('basinDischarge'), `${k.runoff}（${t('estimate')}）`])
    if (k.length) facts.push([t('length'), k.length])
  } else if (opt.isSub) {
    facts.push([t('basinDischarge'), t('noDischarge')])
  }
  return facts
}

export function basinDescription(zhName: string, fallback?: string): string {
  return BASIN_KNOWLEDGE[zhName]?.desc ?? fallback ?? ''
}

export function climateLabel(zone?: string): string { return zoneZh(zone) }
