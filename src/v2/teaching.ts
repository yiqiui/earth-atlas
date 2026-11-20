import type { Rec } from './data4'
import type { Cat } from './config2'
import { catLabel, t } from './i18n2'

/**
 * 教学详情生成器：只为缺少描述/事实的要素填充内容。
 * 文案按地貌类别给出课本级通识，具体数值只来自本地已有数据（坐标、DEM 海拔、
 * Köppen 气候带、所属流域、附近要素），不编造长度/面积等未经核实的数字。
 */
export interface DetailContext {
  climate?: string
  elevation?: number
  parent?: string
  nearby?: string[]
}

const COMMON: Partial<Record<Cat, string>> = {
  peak: '山峰通常由地壳抬升、断裂隆起或火山活动形成，再经风化与冰川侵蚀塑造出尖锐山脊。海拔升高会使气温下降、植被呈垂直分带，是观察内外力共同作用的典型地貌。',
  range: '山脉是多条山峰与山谷组成的线状隆起地带，多形成于板块碰撞或断裂抬升。山脉常成为水系分水岭与气候屏障，迎风坡多雨、背风坡较干燥。',
  river: '河流是降水或冰雪融水沿地表洼地汇集形成的线状水道。上游多峡谷、水流湍急，中下游河道变宽、流速减缓，常发育冲积平原和河口三角洲。',
  lake: '湖泊是地表洼地长期积水形成的水体，按成因可分为构造湖、冰川湖、火山湖和堰塞湖。湖泊能调节径流、改善局地气候，也是重要的淡水资源与湿地生态系统。',
  ocean: '海洋是地球表面连续的水体，约占地球面积的七成。海水吸收太阳辐射并调节全球气候，洋流把热量从低纬输送到高纬，是地球气候系统的重要组成部分。',
  bay: '海湾是海洋向陆地凹入的水域，通常水体较平静、受风浪影响较小，常形成优良港口。湾内海水交换强弱会影响水质与生态系统。',
  gulf: '海湾是海域深入陆地的宽阔水域，与外海通过狭窄水道相连。湾口地形与潮汐决定水体交换，沿岸常发育河口三角洲与浅海大陆架。',
  strait: '海峡是两块陆地之间连接两片海域的狭窄水道，水流受狭管效应影响往往较急。海峡是海上航运要道，也是海洋生物迁徙的重要通道。',
  land: '陆地地貌由内力（地壳运动、火山）与外力（流水、风、冰川）共同塑造。高原、平原、盆地、沙漠等地貌类型反映了不同地区所处的构造与气候环境。',
  island: '岛屿是四面环水的陆地，按成因可分为大陆岛、火山岛、珊瑚岛和冲积岛。岛屿面积小、生态系统独特，常拥有特有种生物，也易受海平面变化影响。',
  cape: '海角是陆地伸入海洋的尖端地形，通常由坚硬岩层抗蚀能力差异形成。海角两侧常发育不同方向的岸线，是海流转向与航行定位的重要地标。',
  trail: '山径与古道多沿河谷、山脊或垭口延伸，反映了人类活动对自然地形的适应。沿线常能观察到垂直植被带、溪流侵蚀与山地聚落的分布规律。',
  current: '洋流是海水沿一定方向的大规模流动，按水温分为暖流与寒流。暖流增温增湿，寒流降温减湿，二者交汇处常形成世界级渔场。',
  fjord: '峡湾是冰川侵蚀形成的狭长海湾：冰期冰川下切山谷，冰退后海平面上升使海水倒灌。峡湾两岸陡峭、水深很大，是冰川地貌的经典代表。',
  climate: '气候类型由纬度、海陆位置、大气环流与地形共同决定。柯本气候分类以气温和降水为核心指标，是中学地理最常用的气候分区体系。',
  biome: '植被类型与气候密切相关：湿润地区发育森林，半干旱地区为草原，干旱地区为荒漠。植被又反过来影响土壤、水文与动物分布。',
  basin: '流域是河流及支流集水的区域，分水岭构成其边界。流域面积决定产水量上限，降水、蒸发、植被与地形共同影响径流的形成与季节变化。',
  subbasin: '子流域是大流域内部的次级集水区，由更小的分水岭分隔。逐级汇总子流域面积与径流，是认识河流水系结构和洪水过程的基础方法。',
  swamp: '沼泽是地表长期过湿、生长喜湿植物的湿地。它能蓄洪防旱、净化水质并维持生物多样性，被称为"地球之肾"。',
}

const fmt = (rec: Rec) => {
  const la = `${Math.abs(rec.lat).toFixed(2)}°${rec.lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(rec.lon).toFixed(2)}°${rec.lon >= 0 ? 'E' : 'W'}`
  return `${la} ${lo}`
}

export function ensureDetail(rec: Rec, ctx: DetailContext): boolean {
  let changed = false
  if (!rec.desc) {
    const parts = [`${rec.name}位于 ${fmt(rec)}`]
    if (ctx.elevation && ctx.elevation > 0) parts.push(`海拔约 ${Math.round(ctx.elevation)} 米`)
    if (ctx.climate) parts.push(`属${ctx.climate}`)
    if (rec.parent || ctx.parent) parts.push(`处于${rec.parent || ctx.parent}范围`)
    rec.desc = `${parts.join('，')}。${COMMON[rec.cat] ?? '该地貌由长期自然作用形成，是认识区域地理环境的重要窗口。'}`
    changed = true
  }
  if (!rec.facts?.length) {
    // 坐标由详情面板统一展示，这里不重复添加
    const facts: [string, string][] = [[t('cat') || '类别', catLabel(rec.cat)]]
    if (ctx.elevation && ctx.elevation > 0) facts.push([t('elevation'), `${Math.round(ctx.elevation)} m`])
    if (ctx.climate) facts.push([t('basinClimate'), ctx.climate])
    if (rec.parent || ctx.parent) facts.push([t('basinName'), rec.parent || ctx.parent || ''])
    if (ctx.nearby?.length) facts.push([t('nearby'), ctx.nearby.join('、')])
    facts.push(['说明', '描述按地貌类型与本地数据生成，供教学示意'])
    rec.facts = facts
    changed = true
  }
  return changed
}

/** 统计仍缺少详情的要素，供浏览器自检。 */
export function detailStats(records: Rec[]): { total: number; noDesc: number; noFacts: number } {
  let noDesc = 0, noFacts = 0
  for (const r of records) { if (!r.desc) noDesc++; if (!r.facts?.length) noFacts++ }
  return { total: records.length, noDesc, noFacts }
}
