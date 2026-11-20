import * as THREE from 'three'
import { BASE, DEFAULT_LAYERS, ALL_LAYERS, D2R, R2D, clamp, type Cat } from './config2'
import { loadAll, applyChineseFallback, type Rec } from './data4'
import { getRealRivers } from './osmRivers'
import { fetchPrecisionRivers, fetchBasinsInView, fetchHydroBasinsInView, queryBasinAt, pointInRing } from './arcgisData'
import { bakeRelief, bakeSatellite } from './bake6'
import { GlobeView2 } from './globe6'
import { FeatureLayer3 } from './features3'
import { LabelLayer3 } from './labels3'
import { Ui3 } from './ui3'
import { lang, t, type Lang, catLabel } from './i18n2'
import { zoneZh } from './palette'
import { parseCoordQuery } from './geoSearch'
import { ensureDetail, detailStats } from './teaching'

const canvas = document.getElementById('globe') as HTMLCanvasElement
let demPixels: Uint8ClampedArray | null = null, demW = 0, demH = 0
function sampleElevation(lat: number, lon: number): number {
  if (!demPixels) return 0
  const x = Math.min(demW - 1, Math.max(0, Math.floor((lon + 180) / 360 * demW)))
  const y = Math.min(demH - 1, Math.max(0, Math.floor((90 - lat) / 180 * demH)))
  return demPixels[(y * demW + x) * 4] / 255 * 9500 - 500
}
function surfaceRadius(lat: number, lon: number): number {
  return 1 + Math.max(sampleElevation(lat, lon), 0) / 9000 * 0.04 * view.exagg
}
const view = {
  theta: 2.3, phi: Math.PI / 2 - 0.4, dist: 3.6,
  targetTheta: 2.3, targetPhi: Math.PI / 2 - 0.4, targetDist: 3.6,
  exagg: 0, fly: null as null | { from: number[]; to: number[]; t0: number; dur: number },
}
let globe!: GlobeView2, features!: FeatureLayer3, labels!: LabelLayer3, ui!: Ui3
let all: Rec[] = [], enabled = new Set<Cat>(DEFAULT_LAYERS), hovered: Rec | null = null
/** 用户影像开关偏好：与地形夸张独立，避免滑块强制改写按钮状态。 */
let tilesUserOn = false

function updateCamera(): void {
  const { theta, phi, dist } = view
  globe.camera.position.set(dist * Math.sin(phi) * Math.cos(theta), dist * Math.cos(phi), -dist * Math.sin(phi) * Math.sin(theta))
  globe.camera.lookAt(0, 0, 0)
}
function refresh(): void {
  features.setFeatures(all, view.exagg, view.dist)
  features.setCats(ALL_LAYERS, false); features.setCats([...enabled], true)
  labels.setEnabled(enabled); labels.setFeatures(all)
  ui.setCount(all.length); ui.setStatus('自然地貌', '待命', all.length)
}

/** 当前视野的经纬度包围盒（可视半径 = 相机对球面的切锥角 acos(1/dist)）。 */
function bboxesInView(): [number, number, number, number][] {
  const half = Math.min(180, Math.acos(clamp(1 / view.dist, -1, 1)) * R2D + 2)
  const cLat = 90 - view.phi * R2D
  const cLon = view.theta * R2D
  const s = Math.max(-85, cLat - half), n = Math.min(85, cLat + half)
  let w = cLon - half, e = cLon + half
  if (e > 180) return [[w, s, 180, n], [-180, s, e - 360, n]]
  if (w < -180) return [[w + 360, s, 180, n], [-180, s, e, n]]
  return [[w, s, e, n]]
}

/** 按坐标反查所在气候带（气候面来自真实 Köppen 数据）。 */
function climateAt(lon: number, lat: number): string {
  const p: [number, number] = [lon, lat]
  for (const r of all) {
    if (r.cat !== 'climate' || !r.rings) continue
    for (const ring of r.rings) if (pointInRing(p, ring)) return zoneZh(r.zone) || r.name
  }
  return ''
}

let basinFetching = false, basinLast: { lat: number; lon: number; dist: number } | null = null
/** 按视野按需拉取流域面（Global Water Provinces，含流域面积）。 */
async function updateBasins(force = false): Promise<void> {
  const wantBasin = enabled.has('basin'), wantSub = enabled.has('subbasin')
  if ((!wantBasin && !wantSub) || basinFetching) return
  const cLat = 90 - view.phi * R2D, cLon = view.theta * R2D
  const half = Math.min(180, Math.acos(clamp(1 / view.dist, -1, 1)) * R2D + 2)
  if (basinLast && !force) {
    const moved = Math.hypot(cLat - basinLast.lat, (cLon - basinLast.lon) * Math.cos(cLat * D2R))
    if (moved < half * 0.4 && Math.round(view.dist) === Math.round(basinLast.dist)) return
  }
  basinFetching = true
  try {
    const boxes = bboxesInView()
    const parts = await Promise.all(boxes.map(([w, s, e, n]) => fetchBasinsInView(w, s, e, n)))
    let recs = parts.filter((x): x is Rec[] => Array.isArray(x) && x.length > 0).flat()
    // 实验双轨：HydroSHEDS v2 提供更细的 HYBAS_ID 子集水区；服务不可用时静默忽略
    if (wantSub) {
      const hydroParts = await Promise.all(boxes.map(([w, s, e, n]) => fetchHydroBasinsInView(w, s, e, n)))
      const hydro = hydroParts.filter((x): x is Rec[] => Array.isArray(x) && x.length > 0).flat()
      const ids = new Set(recs.map(r => r.id))
      recs = recs.concat(hydro.filter(r => !ids.has(r.id)))
    }
    if (recs.length) {
      const byId = new Map<string, Rec>()
      for (const r of recs) byId.set(r.id, r)   // 跨日界线两半请求的同名流域去重
      all = all.filter(r => r.cat !== 'basin' && r.cat !== 'subbasin').concat([...byId.values()])
      basinLast = { lat: cLat, lon: cLon, dist: view.dist }
      refresh()
    }
  } catch (e) { console.error('[basin] fetch/rebuild failed:', e) } finally { basinFetching = false }
}
function flyTo(rec: Rec): void {
  // 点击要素飞到该地并放大（近景触发 z18 高清瓦片），便于查看岛屿/城市级地貌
  view.fly = { from: [view.theta, view.phi, view.dist], to: [rec.lon * D2R, clamp((90 - rec.lat) * D2R, 0.1, Math.PI - 0.1), 1.02], t0: performance.now(), dur: 1100 }
}
function select(rec: Rec): void { features.setSelected(rec); showDetail(rec); flyTo(rec) }
/** 取距离最近的几个不同名地貌，供通用详情展示"附近地貌"。 */
function nearbyNames(rec: Rec, n = 3): string[] {
  const seen = new Set<string>()
  return all.filter(r => r !== rec && r.cat !== 'basin' && r.cat !== 'subbasin' && !seen.has(r.name))
    .map(r => ({
      r,
      d: Math.hypot((r.lon - rec.lon) * Math.cos(rec.lat * D2R), r.lat - rec.lat),
    }))
    .filter(x => x.d < 30).sort((a, b) => a.d - b.d)
    .slice(0, n).map(x => { seen.add(x.r.name); return x.r.name })
}

function showDetail(rec: Rec): void {
  const climateNow = climateAt(rec.lon, rec.lat)
  const elevNow = Math.round(sampleElevation(rec.lat, rec.lon))
  ensureDetail(rec, { climate: climateNow, elevation: elevNow, parent: rec.parent, nearby: nearbyNames(rec) })
  const d = document.getElementById('detail')!
  d.dataset.rid = rec.id
  const la = `${Math.abs(rec.lat).toFixed(3)}° ${rec.lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(rec.lon).toFixed(3)}° ${rec.lon >= 0 ? 'E' : 'W'}`
  const extra: [string, string][] = []
  const elev = Math.round(sampleElevation(rec.lat, rec.lon))
  if (elev > 0 && !['ocean', 'gulf', 'bay', 'strait'].includes(rec.cat)
      && !(rec.facts ?? []).some(([k]) => k === t('elevation'))) extra.push([t('elevation'), `${elev} m`])
  const climate = climateAt(rec.lon, rec.lat)
  if (climate && !(rec.facts ?? []).some(([k]) => k === t('basinClimate'))) extra.push([t('basinClimate'), climate])
  if (rec.cat === 'subbasin' && rec.parent) extra.push([t('basinName'), rec.parent])
  const facts = [...extra, ...(rec.facts ?? [])].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  // 简/繁中界面不显示英文原名（UI 不夹杂英文）
  const showEn = !lang().startsWith('zh')
  d.innerHTML = `<button class="close">×</button><h2>${rec.names[lang()] || rec.name}</h2>
    ${showEn && rec.nameEn ? `<div class="en">${rec.nameEn}</div>` : ''}<span class="cat">${catLabel(rec.cat)}</span>
    ${rec.desc ? `<p>${rec.desc}</p>` : ''}
    <dl><dt>${t('coord')}</dt><dd>${la} · ${lo}</dd>${facts}</dl>`
  d.hidden = false
  d.querySelector('.close')!.addEventListener('click', () => { d.hidden = true; features.setSelected(null) })
  // 河流：实时查询所属流域与流域面积（科普数据，来自 Global Water Provinces）
  if (rec.cat === 'river') {
    const pt: [number, number] = rec.path?.length
      ? rec.path[Math.floor(rec.path.length / 2)]
      : [rec.lon, rec.lat]
    void queryBasinAt(pt[0], pt[1]).then(hit => {
      if (!hit || d.hidden || d.dataset.rid !== rec.id) return
      const dl = d.querySelector('dl')
      if (!dl) return
      dl.insertAdjacentHTML('beforeend',
        `<dt>${t('basinName')}</dt><dd>${hit.zh}</dd>` +
        (hit.subName ? `<dt>${t('basinCountry')}</dt><dd>${hit.subName}</dd>` : '') +
        (hit.areaKm2 > 0 ? `<dt>${t('basinArea')}</dt><dd>${Math.round(hit.areaKm2).toLocaleString('zh-CN')} km²</dd>` : ''))
    })
  }
}
function bindPointer(): void {
  const pointers = new Map<number, { x: number; y: number }>()
  let moved = false, downX = 0, downY = 0, lastDrag = 0, pinch = 0
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    canvas.classList.add('dragging'); view.fly = null; moved = false; downX = e.clientX; downY = e.clientY
  })
  canvas.addEventListener('pointermove', e => {
    if (pointers.has(e.pointerId)) {
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 5) moved = true
      const prev = pointers.get(e.pointerId)!
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (pointers.size === 1) {
        view.targetTheta -= dx * 0.005
        view.targetPhi = clamp(view.targetPhi - dy * 0.005, 0.02, Math.PI - 0.02)
      } else if (pointers.size === 2) {
        const p = [...pointers.values()]; const dd = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)
        if (pinch) view.targetDist = clamp(view.targetDist * (pinch / dd), 1.02, 9)
        pinch = dd
      }
      return
    }
    const rect = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, globe.camera)
    const hit = features.pick(ray, globe.camera); const tip = document.getElementById('tooltip')!
    if (hit) {
      hovered = hit; tip.innerHTML = `${hit.names[lang()] || hit.name}<small>${catLabel(hit.cat)}</small>`
      tip.style.left = `${e.clientX + 14}px`; tip.style.top = `${e.clientY + 14}px`; tip.hidden = false
    } else { hovered = null; tip.hidden = true }
    const sph = new THREE.Sphere(new THREE.Vector3(), 1)
    const hp = ray.ray.intersectSphere(sph, new THREE.Vector3())
    if (hp) {
      const lat = Math.asin(clamp(hp.y, -1, 1)) * R2D, lon = Math.atan2(-hp.z, hp.x) * R2D
      const elev = Math.round(sampleElevation(lat, lon))
      ui.setCoord(`${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'} · ${elev} m`)
    }
  })
  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId)
    if (pointers.size < 2) pinch = 0
    if (!pointers.size) { canvas.classList.remove('dragging'); lastDrag = performance.now() }
  }
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end)
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.targetDist = clamp(view.targetDist * Math.exp(e.deltaY * 0.001), 1.02, 9) }, { passive: false })
  canvas.addEventListener('click', e => {
    if (moved) { moved = false; return }
    if (performance.now() - lastDrag < 200) return
    // 直接用点击位置重新拾取，避免 hover 状态缺失（快速点击/触屏/标签遮挡）导致点了没反应
    const rect = canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, globe.camera)
    const hit = features.pick(ray, globe.camera) ?? hovered
    if (hit) { hovered = hit; select(hit) }
  })
}
function ease(t: number): number { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }
function tick(now: number): void {
  if (view.fly) {
    const k = ease(clamp((now - view.fly.t0) / view.fly.dur, 0, 1))
    for (let i = 0; i < 3; i++) {
      const v = view.fly.from[i] + (view.fly.to[i] - view.fly.from[i]) * k
      if (i === 0) view.theta = view.targetTheta = v
      if (i === 1) view.phi = view.targetPhi = v
      if (i === 2) view.dist = view.targetDist = v
    }
    if (k >= 1) view.fly = null
  } else {
    view.theta += (view.targetTheta - view.theta) * 0.16
    view.phi += (view.targetPhi - view.phi) * 0.16
    view.dist += (view.targetDist - view.dist) * 0.16
  }
  updateCamera()
  // 相机视线中心的经纬度：lat = 90° - phi, lon = theta
  const centerLat = 90 - view.phi * R2D
  const centerLon = view.theta * R2D
  globe.updateTiles(centerLat, centerLon, view.dist)
  features.setLod(view.exagg, view.dist)
  labels.update(globe.camera, view.dist)
  if (enabled.has('basin') || enabled.has('subbasin')) void updateBasins()
  globe.render(); requestAnimationFrame(tick)
}
async function init(): Promise<void> {
  ui = new Ui3({
    onToggleCat(cats, on) {
      for (const c of cats) on ? enabled.add(c) : enabled.delete(c)
      features.setCats(cats, on); labels.setEnabled(enabled)
      if (on && cats.some(c => c === 'basin' || c === 'subbasin')) { basinLast = null; void updateBasins(true) }
    },
    onSurface(kind) { globe.showSurface(kind); ui.toast(kind === 'relief' ? t('relief') : t('satellite')) },
    onToggleTiles(on) {
      tilesUserOn = on
      globe.setTilesActive(on && view.exagg === 0)
      ui.toast(on ? '在线高清瓦片' : '离线静态影像')
    },
    onClouds(on) { globe.setClouds(on) }, onGrid(on) { globe.setGrid(on) },
    onExaggeration(v) {
      view.exagg = v
      globe.setExaggeration(v)
      // 地形起伏>0 时临时停用瓦片避免穿模；用户影像开关偏好保持不变，互不覆盖
      globe.setTilesActive(tilesUserOn && v === 0)
      if (v > 0) ui.setToggle('btn-tiles', false)
      else ui.setToggle('btn-tiles', tilesUserOn)
      ui.toast(v === 0 ? '高清卫星瓦片' : '地形起伏模式')
    },
    onReset() { view.targetTheta = 2.3; view.targetPhi = Math.PI / 2 - 0.4; view.targetDist = 3.6; view.fly = null },
    onLang(_l: Lang) { labels.setFeatures(all) },
    onSearch(q) {
      if (!q) return []
      const c = parseCoordQuery(q)
      if (c) return [{
        id: `coord:${c.lat}:${c.lon}`,
        name: `${t('coordSearch')} ${c.lat.toFixed(3)}°, ${c.lon.toFixed(3)}°`,
        cat: 'land' as Cat,
      }]
      const low = q.toLowerCase()
      return all.filter(r => r.name.includes(q) || r.names.zh?.includes(q) || r.nameEn?.toLowerCase().includes(low))
        .slice(0, 24).map(r => ({ id: r.id, name: r.names[lang()] || r.name, cat: r.cat }))
    },
    onSelect(id) {
      if (id.startsWith('coord:')) {
        const [, la, lo] = id.split(':')
        const lat = Number(la), lon = Number(lo)
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
        const elev = Math.round(sampleElevation(lat, lon))
        const cz = climateAt(lon, lat)
        const facts: [string, string][] = [[t('elevation'), `${elev} m`]]
        if (cz) facts.push([t('basinClimate'), cz])
        select({
          id, name: `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`,
          names: { zh: `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`, en: id },
          cat: 'land', lat, lon, facts, desc: t('coordSearch'), source: 'coord',
          updatedAt: new Date().toISOString(),
        })
        return
      }
      const r = all.find(x => x.id === id); if (r) select(r)
    },
  })
  ui.setCoord('—')
  globe = new GlobeView2(canvas, sampleElevation)
  features = new FeatureLayer3(globe.scene, surfaceRadius, ALL_LAYERS)
  labels = new LabelLayer3(document.getElementById('labels')!, surfaceRadius)
  try {
    const res = await fetch(BASE + 'data/base/dem.png')
    const bmp = await createImageBitmap(await res.blob())
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height
    const ctx = c.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(bmp, 0, 0)
    demPixels = ctx.getImageData(0, 0, c.width, c.height).data; demW = c.width; demH = c.height; bmp.close()
  } catch { ui.toast('高程数据加载失败') }
  all = await loadAll(s => ui.setStatus(s, '待命', all.length))
  // 用精选真实水系替换简化河流（长江/黄河含几字弯/湄公河全河段等）
  const realRivers = getRealRivers()
  const realNames = new Set(realRivers.map(r => r.name))
  all = all.filter(r => !(r.cat === 'river' && (realNames.has(r.name) || r.name === '澜沧江'))).concat(realRivers)
  refresh()
  // 高精度河道（Natural Earth 10m，含中文名与真实河型几何，如黄河几字弯）；失败静默回退本地数据
  ui.setStatus('获取高精度河道数据', t('querying'), all.length)
  const precise = await fetchPrecisionRivers()
  if (precise?.length) {
    // 中文名兜底（与本地数据同一套译名库），并保留原文到 nameEn 供外文界面
    applyChineseFallback(precise)
    // 保留精选河流的教学描述/趣味数据（按河名合并）
    const teach = new Map(
      all.filter(r => r.cat === 'river' && (r.desc || r.facts || r.teaching)).map(r => [r.name, r]),
    )
    for (const r of precise) {
      const src = teach.get(r.name)
      if (src) { r.desc = src.desc; r.facts = src.facts; r.teaching = src.teaching; if (!r.nameEn) r.nameEn = src.nameEn }
    }
    all = all.filter(r => r.cat !== 'river').concat(precise)
    refresh()
  }
  ui.setStatus('自然地貌', '待命', all.length)
  bakeRelief(s => ui.setStatus(s, '待命', all.length)).then(bmp => { if (bmp) { globe.setSurface('relief', bmp); globe.showSurface('relief') } })
  bakeSatellite(() => {}).then(bmp => { if (bmp) globe.setSurface('satellite', bmp) })
  bindPointer()
  window.addEventListener('resize', () => { globe.resize(); features.resize() })
  updateCamera(); requestAnimationFrame(tick)
  Object.assign(window as any, {
    __atlas2: {
      view, data: () => all, select, globe, features, labels, ui,
      enabled: () => [...enabled], audit: () => features.audit(),
      parseCoordQuery,
      terrain: () => ({ exagg: view.exagg, tilesUserOn, tilesActive: !!(globe as any).tiles?.active }),
      perf: () => ({ lod: features.lodInfo(), render: { ...globe.renderer.info.render }, dist: view.dist }),
      detailStats: () => detailStats(all),
      tickOnce: () => tick(performance.now()),
    },
  })
}
void init()
