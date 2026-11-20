/**
 * 生成教学专题数据（示意性质）：洋流、气候类型、草原/植被。
 * 数据为教学示意，来源于公开地理常识整理，不作科研用途。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'data', 'base')
fs.mkdirSync(out, { recursive: true })

const write = (name, features) => {
  fs.writeFileSync(path.join(out, name), JSON.stringify({ type: 'FeatureCollection', features }))
  console.log(`${name}: ${features.length} 个要素`)
}

const line = (id, name, nameEn, names, temp, pathCoords, teaching) => ({
  type: 'Feature', id,
  properties: { name, name_en: nameEn, featurecla: 'current', temp, teaching, ...names },
  geometry: { type: 'LineString', coordinates: pathCoords },
})

/* -------------------- 洋流（暖流 / 寒流） -------------------- */
const N = (zh, en, ja, ko, fr, ru, de, es, pt, it, ar) => ({
  name_zh: zh, name_en: en, name_ja: ja, name_ko: ko, name_fr: fr,
  name_ru: ru, name_de: de, name_es: es, name_pt: pt, name_it: it, name_ar: ar,
})

const currents = [
  line('gulf-stream', '墨西哥湾暖流', 'Gulf Stream', N('墨西哥湾暖流', 'Gulf Stream', 'メキシコ湾流', '멕시코 만류', 'Courant du Golfe', 'Гольфстрим', 'Golfstrom', 'Corriente del Golfo', 'Corrente do Golfo', 'Corrente del Golfo', 'تيار الخليج'), 'warm',
    [[-80, 25], [-75, 30], [-70, 35], [-60, 40], [-45, 45], [-30, 50], [-15, 55], [0, 60]],
    '北大西洋最重要的暖流，使西欧冬季温和，同纬度比东亚温暖。'),
  line('north-atlantic', '北大西洋暖流', 'North Atlantic Drift', N('北大西洋暖流', 'North Atlantic Drift', '北大西洋海流', '북대서양 해류', 'Dérive nord-atlantique', 'Северо-Атлантическое течение', 'Nordatlantikstrom', 'Deriva del Atlántico Norte', 'Corrente do Atlântico Norte', 'Corrente dell’Atlantico Nord', 'تيار شمال الأطلسي'), 'warm',
    [[-20, 55], [-10, 58], [0, 60], [8, 62], [15, 65], [22, 68]],
    '墨西哥湾暖流的延续，深入北极圈，使挪威北部港口终年不冻。'),
  line('kuroshio', '日本暖流（黑潮）', 'Kuroshio', N('日本暖流', 'Kuroshio', '黒潮', '쿠로시오', 'Kuroshio', 'Куросио', 'Kuroshio', 'Kuroshio', 'Kuroshio', 'Kuroshio', 'تيار كوروشيو'), 'warm',
    [[122, 18], [124, 22], [127, 26], [130, 30], [135, 34], [140, 36], [145, 38], [150, 40]],
    '太平洋最强暖流之一，沿台湾东侧、日本南岸北上，影响东亚气候与渔业。'),
  line('north-pacific', '北太平洋暖流', 'North Pacific Drift', N('北太平洋暖流', 'North Pacific Drift', '北太平洋海流', '북태평양 해류', 'Dérive nord-pacifique', 'Северо-Тихоокеанское течение', 'Nordpazifikstrom', 'Deriva del Pacífico Norte', 'Corrente do Pacífico Norte', 'Corrente del Pacifico Nord', 'تيار شمال المحيط الهادئ'), 'warm',
    [[150, 40], [165, 42], [-180, 43], [-165, 44], [-150, 45], [-135, 46]],
    '黑潮延续，向东横跨北太平洋，抵达北美西岸。'),
  line('brazil', '巴西暖流', 'Brazil Current', N('巴西暖流', 'Brazil Current', 'ブラジル海流', '브라질 해류', 'Courant du Brésil', 'Бразильское течение', 'Brasilstrom', 'Correiente de Brasil', 'Corrente do Brasil', 'Corrente del Brasile', 'تيار البرازيل'), 'warm',
    [[-38, -8], [-37, -15], [-40, -22], [-45, -28], [-50, -34], [-55, -38]],
    '沿南美东岸南下的暖流，与 Falkland 寒流交汇形成渔场。'),
  line('agulhas', '厄加勒斯暖流', 'Agulhas Current', N('厄加勒斯暖流', 'Agulhas Current', 'アグラス海流', '아굴라스 해류', 'Courant d’Aguilhas', 'Течение Агульяс', 'Agulhasstrom', 'Corriente de Agujas', 'Corrente de Agulhas', 'Corrente di Agulhas', 'تيار أغولاس'), 'warm',
    [[40, -15], [38, -22], [35, -28], [30, -33], [25, -36], [20, -38]],
    '非洲东岸最强暖流，向南流至好望角附近。'),
  line('east-australian', '东澳大利亚暖流', 'East Australian Current', N('东澳大利亚暖流', 'East Australian Current', '東オーストラリア海流', '동오스트레일리아 해류', 'Courant d’Est-Australie', 'Восточно-Австралийское течение', 'Ostaustralischer Strom', 'Corriente de Australia Oriental', 'Corrente da Austrália Oriental', 'Corrente dell’Australia Orientale', 'تيار شرق أستراليا'), 'warm',
    [[150, -18], [153, -24], [154, -30], [153, -36], [150, -42]],
    '沿澳大利亚东岸南下的暖流，使沿岸增温增湿。'),
  line('labrador', '拉布拉多寒流', 'Labrador Current', N('拉布拉多寒流', 'Labrador Current', 'ラブラドル海流', '라브라도 해류', 'Courant du Labrador', 'Лабрадорское течение', 'Labradorstrom', 'Corriente del Labrador', 'Corrente do Labrador', 'Corrente del Labrador', 'تيار لابرادور'), 'cold',
    [[-55, 70], [-55, 63], [-56, 56], [-54, 50], [-52, 45], [-50, 42]],
    '沿格陵兰与拉布拉多东岸南下的寒流，与墨西哥湾暖流交汇形成纽芬兰渔场。'),
  line('california', '加利福尼亚寒流', 'California Current', N('加利福尼亚寒流', 'California Current', 'カリフォルニア海流', '캘리포니아 해류', 'Courant de Californie', 'Калифорнийское течение', 'Kalifornischer Strom', 'Corriente de California', 'Corrente da Califórnia', 'Corrente della California', 'تيار كاليفورنيا'), 'cold',
    [[-125, 48], [-124, 42], [-121, 36], [-118, 30], [-115, 25], [-112, 20]],
    '沿北美西岸南下的寒流，使加利福尼亚沿岸夏季多雾、降水稀少。'),
  line('peru', '秘鲁寒流（洪堡寒流）', 'Peru (Humboldt) Current', N('秘鲁寒流', 'Courant du Pérou', 'ペルー海流', '페루 해류', 'Courant du Pérou', 'Перуанское течение', 'Perustrom', 'Corriente de Humboldt', 'Corrente do Peru', 'Corrente del Perù', 'تيار بيرو'), 'cold',
    [[-75, -42], [-74, -35], [-77, -28], [-79, -20], [-81, -12], [-83, -5]],
    '上升补偿流带来丰富营养盐，形成世界著名秘鲁渔场，并使沿岸干旱。'),
  line('canary', '加那利寒流', 'Canary Current', N('加那利寒流', 'Canary Current', 'カナリー海流', '카나리아 해류', 'Courant des Canaries', 'Канарское течение', 'Kanarenstrom', 'Corriente de Canarias', 'Corrente das Canárias', 'Corrente delle Canarie', 'تيار الكناري'), 'cold',
    [[-12, 45], [-14, 38], [-16, 32], [-18, 26], [-20, 20], [-22, 15]],
    '沿非洲西北岸南下的寒流，使撒哈拉西岸多雾而干旱。'),
  line('benguela', '本格拉寒流', 'Benguela Current', N('本格拉寒流', 'Benguela Current', 'ベンゲラ海流', '벤게라 해류', 'Courant de Benguela', 'Бенгельское течение', 'Benguelastrom', 'Corriente de Benguela', 'Corrente de Benguela', 'Corrente di Benguela', 'تيار بنغويلا'), 'cold',
    [[12, -35], [10, -30], [9, -24], [10, -18], [12, -12], [13, -6]],
    '沿非洲西南岸北上的寒流，造成纳米布沙漠沿岸的干旱。'),
  line('west-wind-drift', '西风漂流', 'West Wind Drift', N('西风漂流', 'West Wind Drift', '西風漂流', '서풍 표류', 'Dérive des vents d’ouest', 'Течение западных ветров', 'Westwinddrift', 'Deriva de los Vientos del Oeste', 'Deriva dos Ventos de Oeste', 'Deriva dei Venti Occidentali', 'تيار الرياح الغربية'), 'cold',
    [[40, -50], [60, -52], [90, -55], [120, -55], [150, -55], [180, -55], [-150, -55], [-120, -52], [-90, -50], [-60, -50]],
    '环绕南极大陆的寒流，受盛行西风驱动，是全球最大的洋流系统之一。'),
]
write('currents.json', currents)

/* -------------------- 气候类型（教学简化示意多边形） -------------------- */
const poly = (id, name, nameEn, zone, names, rings, teaching) => ({
  type: 'Feature', id,
  properties: { name, name_en: nameEn, featurecla: 'climate', zone, teaching, ...names },
  geometry: { type: 'Polygon', coordinates: [rings] },
})

const C = (zh, en) => ({ name_zh: zh, name_en: en })

const climates = [
  poly('tropical-rainforest', '热带雨林气候', 'Tropical rainforest', 'tropical-rainforest',
    C('热带雨林气候', 'Tropical rainforest'),
    [[-10, -60], [10, -62], [12, -50], [-8, -48], [-10, -60]],
    '赤道附近全年高温多雨，如亚马孙平原、刚果盆地、马来群岛。小学到高中重点。'),
  poly('tropical-monsoon', '热带季风气候', 'Tropical monsoon', 'tropical-monsoon',
    C('热带季风气候', 'Tropical monsoon'),
    [[68, 8], [88, 8], [90, 25], [78, 28], [68, 22], [68, 8]],
    '全年高温，分旱雨两季，主要分布在印度半岛和中南半岛。'),
  poly('tropical-desert', '热带沙漠气候', 'Tropical desert', 'tropical-desert',
    C('热带沙漠气候', 'Tropical desert'),
    [[-17, 15], [35, 15], [35, 32], [-17, 32], [-17, 15]],
    '终年炎热干燥，如撒哈拉沙漠、阿拉伯半岛。回归线附近大陆内部和西岸。'),
  poly('temperate-continental', '温带大陆性气候', 'Temperate continental', 'temperate-continental',
    C('温带大陆性气候', 'Temperate continental'),
    [[35, 40], [135, 42], [140, 60], [50, 65], [35, 55], [35, 40]],
    '冬冷夏热、年温差大、降水少且集中夏季，分布于亚欧大陆和北美大陆内部。大学以上重点。'),
  poly('temperate-monsoon', '温带季风气候', 'Temperate monsoon', 'temperate-monsoon',
    C('温带季风气候', 'Temperate monsoon'),
    [[105, 33], [130, 33], [135, 48], [115, 50], [105, 42], [105, 33]],
    '夏季高温多雨、冬季寒冷干燥，分布于中国东部、朝鲜半岛、日本北部。'),
  poly('mediterranean', '地中海气候', 'Mediterranean', 'mediterranean',
    C('地中海气候', 'Mediterranean'),
    [[-9, 30], [36, 30], [36, 45], [-9, 45], [-9, 30]],
    '夏季炎热干燥、冬季温和多雨，是唯一雨热不同期的气候类型。'),
  poly('temperate-maritime', '温带海洋性气候', 'Temperate maritime', 'temperate-maritime',
    C('温带海洋性气候', 'Temperate maritime'),
    [[-12, 40], [25, 42], [30, 58], [-12, 58], [-12, 40]],
    '全年温和湿润、降水均匀，受西风和暖流影响，典型如西欧。'),
  poly('plateau-mountain', '高原山地气候', 'Highland', 'plateau-mountain',
    C('高原山地气候', 'Highland'),
    [[75, 28], [105, 28], [105, 40], [75, 40], [75, 28]],
    '垂直地带性显著，随海拔升高气候与植被呈垂直变化，青藏高原典型。'),
  poly('polar', '寒带气候', 'Polar', 'polar',
    C('寒带气候', 'Polar'),
    [[-180, 66], [180, 66], [180, 90], [-180, 90], [-180, 66]],
    '终年寒冷，长冬无夏，分布于北极圈以北和南极大陆。'),
]
// 气候改由 scripts/fetch-climate.mjs 从真实 Köppen-Geiger 服务生成，避免覆盖。
write('climate-fallback.json', climates)

/* -------------------- 草原 / 植被 -------------------- */
const biomePoly = (id, name, nameEn, zone, names, rings, teaching) => ({
  type: 'Feature', id,
  properties: { name, name_en: nameEn, featurecla: 'biome', zone, teaching, ...names },
  geometry: { type: 'Polygon', coordinates: [rings] },
})

const biomes = [
  biomePoly('temperate-grassland', '温带草原', 'Temperate grassland', 'temperate-grassland',
    C('温带草原', 'Temperate grassland'),
    [[40, 40], [120, 42], [125, 55], [45, 55], [40, 40]],
    '温带半干旱地区的植被，如欧亚草原带、北美大平原，土壤肥沃，是世界重要农牧业区。'),
  biomePoly('tropical-savanna', '热带草原（稀树草原）', 'Tropical savanna', 'tropical-savanna',
    C('热带草原', 'Tropical savanna'),
    [[-15, -18], [40, -18], [42, 8], [-15, 8], [-15, -18]],
    '干湿季分明，稀疏乔木与高草相间，非洲热带草原典型，动物迁徙壮观。'),
  biomePoly('temperate-forest', '温带落叶阔叶林', 'Temperate deciduous forest', 'temperate-forest',
    C('温带落叶阔叶林', 'Temperate deciduous forest'),
    [[-10, 40], [45, 42], [50, 58], [-10, 58], [-10, 40]],
    '温带湿润地区的典型植被，夏季葱绿、冬季落叶。'),
  biomePoly('coniferous-forest', '亚寒带针叶林（泰加林）', 'Boreal forest', 'coniferous-forest',
    C('亚寒带针叶林', 'Boreal forest'),
    [[45, 55], [140, 55], [145, 68], [45, 68], [45, 55]],
    '亚寒带地区广布，耐寒针叶树为主，是重要的木材与碳汇资源。'),
]
write('biomes.json', biomes)

/* -------------------- 峡湾（精选示例） -------------------- */
const fjord = (id, name, nameEn, coordinates, teaching) => ({
  type: 'Feature', id,
  properties: { name, name_en: nameEn, featurecla: 'fjord', cat: 'fjord',
    teaching, desc: teaching,
    facts: [['类型', '冰川侵蚀形成的狭长海湾'], ['成因', '冰期冰川下切，海平面上升后海水倒灌']] },
  geometry: { type: 'LineString', coordinates },
})

const fjords = [
  fjord('sognefjord', '松恩峡湾', 'Sognefjord', [[5.0, 61.1], [6.0, 61.2], [7.1, 61.3]], '挪威最长最深的峡湾，全长约204公里，两岸陡崖高耸，是冰川地貌的经典代表。'),
  fjord('geirangerfjord', '盖朗厄尔峡湾', 'Geirangerfjord', [[6.9, 62.1], [7.0, 62.05], [7.2, 62.0]], '挪威著名峡湾，两侧瀑布众多，2015年列入世界自然遗产。'),
  fjord('hardangerfjord', '哈当厄尔峡湾', 'Hardangerfjord', [[5.6, 60.1], [6.3, 60.2], [7.0, 60.3]], '挪威第二大峡湾，以果树花海与雪山相映著称。'),
  fjord('poser', '波斯峡湾', 'Poser Fjord', [[-49.5, 60.0], [-48.5, 60.1], [-47.6, 60.2]], '格陵兰东岸大型峡湾，冰山漂浮，展现极地冰川地貌。'),
  fjord('scoresby', '斯科斯比湾', 'Scoresby Sund', [[-25.0, 70.5], [-23.0, 70.6], [-21.0, 70.7]], '格陵兰最大峡湾系统，长约350公里，是北极地区最长的峡湾。'),
  fjord('milford', '米尔福德峡湾', 'Milford Sound', [[167.6, -44.6], [167.9, -44.55], [168.1, -44.5]], '新西兰南岛西南部峡湾，年平均降水超过7000毫米，有"世界第八大奇迹"之称。'),
  fjord('doubtful', '疑峡湾', 'Doubtful Sound', [[166.9, -45.3], [167.1, -45.25], [167.3, -45.2]], '新西兰第二大峡湾，深入内陆，两岸为温带雨林。'),
  fjord('fjallene', '费亚莱恩峡湾', 'Fjallane Fjord', [[5.2, 61.5], [5.5, 61.45], [5.8, 61.4]], '挪威西岸峡湾群的一部分，山体直插入海。'),
  fjord('puerto', '智利南部峡湾', 'Chilean Fjords', [[-74.5, -50.0], [-74.0, -50.2], [-73.5, -50.4]], '智利南部巴塔哥尼亚峡湾群，冰川末端直接与海湾相连。'),
  fjord('narrow', '阿拉斯加窄湾', 'Narrow Fjord', [[-134.0, 57.0], [-133.5, 57.05], [-133.0, 57.1]], '阿拉斯加东南部的狭长冰川海湾，两岸针叶林密布。'),
]
write('fjords.json', fjords)

/* -------------------- 沼泽湿地（精选示例） -------------------- */
const swamp = (id, name, nameEn, lon, lat, teaching, area) => ({
  type: 'Feature', id,
  properties: { name, name_en: nameEn, featurecla: 'swamp', cat: 'swamp',
    teaching, desc: teaching,
    facts: [['类型', area], ['生态', '水源涵养、生物多样性丰富']] },
  geometry: { type: 'Point', coordinates: [lon, lat] },
})

const swamps = [
  swamp('pantanal', '潘塔纳尔湿地', 'Pantanal', -57.0, -17.5, '世界最大的热带淡水湿地，位于南美洲中部，雨季面积可达14万平方公里，是美洲豹与上千种鸟类的栖息地。', '世界最大热带淡水湿地'),
  swamp('everglades', '大沼泽地', 'Everglades', -80.8, 25.5, '美国佛罗里达南部的亚热带湿地，被称为"草之河"，是独特的锯齿草沼泽生态系统。', '亚热带沼泽'),
  swamp('sudd', '苏德沼泽', 'Sudd', 30.5, 8.5, '南苏丹境内尼罗河上游的巨大漂浮植被沼泽，面积随季节在数万平方公里间变化。', '尼罗河上游漂浮沼泽'),
  swamp('okavango', '奥卡万戈三角洲', 'Okavango Delta', 22.8, -19.3, '非洲南部内陆三角洲，河水最终消失于卡拉哈里沙漠，形成世界最大的内陆湿地之一。', '内陆三角洲湿地'),
  swamp('amazon-flood', '亚马孙泛滥平原', 'Amazon floodplain', -60.0, -3.5, '亚马孙河两岸周期性泛滥形成的巨大湿地，孕育丰富的鱼类与水生植物。', '河流泛滥平原'),
  swamp('sanjiang', '三江平原湿地', 'Sanjiang Plain', 132.5, 47.3, '中国东北三江平原，曾是大片沼泽湿地，现为重要粮食产区与湿地保护区。', '温带淡水沼泽'),
  swamp('zoige', '若尔盖湿地', 'Zoige Wetland', 102.5, 33.6, '位于青藏高原东缘，是中国最大的高原泥炭沼泽湿地，也是黄河上游重要水源涵养区。', '高原泥炭沼泽'),
  swamp('mesopotamian', '美索不达米亚沼泽', 'Mesopotamian Marshes', 47.0, 31.0, '伊拉克南部底格里斯河与幼发拉底河下游的沼泽，是古代文明发源地之一。', '两河下游沼泽'),
  swamp('pripyat', '普里皮亚特沼泽', 'Pripyat Marshes', 29.5, 52.0, '东欧乌克兰与白俄罗斯交界的大型沼泽区，属温带大陆性气候下的泥炭湿地。', '温带泥炭沼泽'),
  swamp('tanjung', '丹戎湿地', 'Tanjung Puting', -111.8, -3.0, '印度尼西亚加里曼丹岛的热带泥炭沼泽森林，是猩猩的重要栖息地。', '热带泥炭沼泽森林'),
]
write('swamps.json', swamps)

console.log('教学专题数据生成完毕（教学示意，不作科研用途）')
