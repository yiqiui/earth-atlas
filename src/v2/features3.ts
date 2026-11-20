import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { AREA_CATS, CAT_COLOR, type Cat } from './config2'
import type { Rec } from './data4'
import { pointInRing } from './arcgisData'
import { areaColor } from './palette'
import { LOD, lodFor, simplifyRing, type LodConfig, type LodLevel } from './lod'

function dotTexture(): THREE.CanvasTexture {
  const s = 128
  const c = document.createElement('canvas'); c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/2)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.95)')
  g.addColorStop(0.45, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.fillRect(0, 0, s, s)
  return new THREE.CanvasTexture(c)
}
function llToVec(lat: number, lon: number, r: number): THREE.Vector3 {
  const la = lat * Math.PI / 180, lo = lon * Math.PI / 180
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo))
}
// 面要素类别由 config2.AREA_CATS 统一定义（海域/湖泊/流域 + 气候/植被/子流域/沼泽专题）。

/** 填充三角形长边细分：耳切可能产生跨海盆的长对角线，其弦会沉到球面以下被遮挡。
 *  把超过 maxLen 的边递归对分并投影回球面方向，保证贴合球体。 */
function subdivideTriangles(pos: number[], maxLen: number, colors: number[]): { pos: number[]; colors: number[] } {
  const max2 = maxLen * maxLen
  const out: number[] = [], outC: number[] = []
  const stack: { p: number[]; c: number[] }[] = []
  for (let i = 0; i < pos.length; i += 9) stack.push({ p: pos.slice(i, i + 9), c: colors.slice(i, i + 9) })
  const mid = (a: number[], b: number[]): number[] => {
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
    const r = (Math.hypot(a[0], a[1], a[2]) + Math.hypot(b[0], b[1], b[2])) / 2
    const len = Math.hypot(m[0], m[1], m[2]) || 1
    m[0] = m[0] / len * r; m[1] = m[1] / len * r; m[2] = m[2] / len * r
    return m
  }
  const midC = (a: number[], b: number[]): number[] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]
  const dist2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
  let guard = 0
  while (stack.length && guard++ < 400000) {
    const t = stack.pop()!
    const p = t.p, c = t.c
    const a = [p[0], p[1], p[2]], b = [p[3], p[4], p[5]], cc = [p[6], p[7], p[8]]
    if (dist2(a, b) > max2 || dist2(b, cc) > max2 || dist2(cc, a) > max2) {
      const ab = mid(a, b), bc = mid(b, cc), ca = mid(cc, a)
      const cab = midC(c.slice(0, 3), c.slice(3, 6))
      const cbc = midC(c.slice(3, 6), c.slice(6, 9))
      const cca = midC(c.slice(6, 9), c.slice(0, 3))
      stack.push({ p: [...a, ...ab, ...ca], c: [...c.slice(0, 3), ...cab, ...cca] })
      stack.push({ p: [...ab, ...b, ...bc], c: [...cab, ...c.slice(3, 6), ...cbc] })
      stack.push({ p: [...ca, ...bc, ...cc], c: [...cca, ...cbc, ...c.slice(6, 9)] })
      stack.push({ p: [...ab, ...bc, ...ca], c: [...cab, ...cbc, ...cca] })
    } else {
      out.push(...p); outC.push(...c)
    }
  }
  return out.length ? { pos: out, colors: outC } : { pos, colors }
}

export class FeatureLayer3 {
  private groups = new Map<Cat, THREE.Group>()
  private enabled = new Set<Cat>()
  private all: Rec[] = []
  private lineMats: LineMaterial[] = []
  private proxies: Line2[] = []                                        // 河流拾取代理（不入场景）
  private areaRecs: { rec: Rec; w: number; s: number; e: number; n: number }[] = []
  private dot = dotTexture()
  private selection: THREE.Mesh
  private selectionFill: THREE.Mesh
  private selectionEdge: THREE.LineSegments
  private lodLevel: LodLevel = 'near'
  private lastRebuildMs = 0
  private rebuildHandle: number | null = null

  constructor(scene: THREE.Scene, private radius: (lat: number, lon: number) => number, cats: Cat[]) {
    for (const c of cats) {
      const g = new THREE.Group(); g.name = 'layer-' + c
      this.groups.set(c, g); scene.add(g)
    }
    this.selection = new THREE.Mesh(
      new THREE.RingGeometry(0.016, 0.021, 32),
      new THREE.MeshBasicMaterial({ color: 0xe6c88c, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    )
    this.selection.visible = false
    scene.add(this.selection)
    this.selectionFill = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.62,
      side: THREE.DoubleSide, depthWrite: false,
    }))
    this.selectionEdge = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, opacity: 1, depthWrite: false,
    }))
    this.selectionFill.visible = this.selectionEdge.visible = false
    this.selectionFill.renderOrder = 10; this.selectionEdge.renderOrder = 11
    scene.add(this.selectionFill, this.selectionEdge)
  }

  setCats(cats: Cat[], on: boolean): void {
    if (on) cats.forEach(c => this.enabled.add(c))
    else cats.forEach(c => this.enabled.delete(c))
    this.applyVisibility()
  }
  isEnabled(c: Cat) { return this.enabled.has(c) }
  private applyVisibility() { for (const [c, g] of this.groups) g.visible = this.enabled.has(c) }

  setFeatures(records: Rec[], _e: number, d: number): void {
    this.all = records
    this.lodLevel = lodFor(d, this.lodLevel)
    this.cancelPending()
    this.rebuild()
  }
  /** 每帧调用；只有档位变化才重建，且放到空闲帧执行，避免缩放瞬间卡顿。 */
  setLod(_e: number, d: number): void {
    const next = lodFor(d, this.lodLevel)
    if (next === this.lodLevel) return
    this.lodLevel = next
    this.cancelPending()
    if (typeof requestIdleCallback === 'function') {
      this.rebuildHandle = requestIdleCallback(() => this.rebuild(), { timeout: 250 })
    } else {
      this.rebuildHandle = window.setTimeout(() => this.rebuild(), 0)
    }
  }
  private cancelPending(): void {
    if (this.rebuildHandle == null) return
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(this.rebuildHandle)
    else clearTimeout(this.rebuildHandle)
    this.rebuildHandle = null
  }
  lodInfo(): { level: LodLevel; rebuildMs: number } {
    return { level: this.lodLevel, rebuildMs: this.lastRebuildMs }
  }

  private rebuild(): void {
    const t0 = performance.now()
    this.rebuildHandle = null
    this.clear()
    const byCat = new Map<Cat, Rec[]>()
    for (const r of this.all) {
      if (!this.groups.has(r.cat)) continue
      const arr = byCat.get(r.cat) ?? []; arr.push(r); byCat.set(r.cat, arr)
    }
    const L = LOD[this.lodLevel]
    // 面要素按类别批渲染（每类 1 个填充 + 1 个边界），拾取走经纬度点选
    for (const cat of AREA_CATS) {
      const items = byCat.get(cat)
      if (items) this.buildAreaBatch(cat, items, this.groups.get(cat)!, L)
    }
    // 河流批渲染（4 档线宽 = 4 个 draw call；逐河 Line2 作为拾取代理不入场景）
    const rivers = byCat.get('river')
    if (rivers) this.buildRiverBatch(rivers, this.groups.get('river')!, L)

    for (const [cat, items] of byCat) {
      if (AREA_CATS.includes(cat) || cat === 'river') continue
      const group = this.groups.get(cat)!

      // 点标记
      const pos = new Float32Array(items.length * 3)
      const col = new Float32Array(items.length * 3)
      const base = new THREE.Color(CAT_COLOR[cat])
      items.forEach((r, i) => {
        const v = llToVec(r.lat, r.lon, this.radius(r.lat, r.lon) + 0.005)
        ;(r as any)._pos = v
        pos.set([v.x, v.y, v.z], i * 3); col.set([base.r, base.g, base.b], i * 3)
      })
      const pgeo = new THREE.BufferGeometry()
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const points = new THREE.Points(pgeo, new THREE.PointsMaterial({
        size: cat === 'peak' ? 0.026 : 0.018, map: this.dot, vertexColors: true,
        transparent: true, opacity: 0.9, alphaTest: 0.05, depthWrite: false, sizeAttenuation: true,
      }))
      points.userData.items = items
      group.add(points)

      for (const rec of items) {
        if (!rec.path || rec.path.length < 2) continue
        const pts = rec.path.map(([lon, lat]) => llToVec(lat, lon, this.radius(lat, lon) + 0.0025))
        if (cat === 'current') {
          const mat = new LineMaterial({
            color: rec.temp === 'cold' ? 0x5aa8d8 : 0xe0865a, linewidth: 2.4,
            transparent: true, opacity: 0.9, dashed: true, dashSize: 0.035, gapSize: 0.02, depthWrite: false,
          })
          mat.resolution.set(innerWidth, innerHeight); this.lineMats.push(mat)
          const line = new Line2(new LineGeometry().setPositions(pts.flatMap(v => [v.x, v.y, v.z])), mat)
          line.computeLineDistances(); line.userData.item = rec; group.add(line)
        } else if (cat === 'fjord' || cat === 'trail') {
          const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints(pts),
            new THREE.LineBasicMaterial({ color: CAT_COLOR[cat], transparent: true, opacity: 0.8, depthWrite: false }),
          )
          line.userData.item = rec; group.add(line)
        }
      }
    }
    this.applyVisibility()
    this.lastRebuildMs = Math.round(performance.now() - t0)
  }

  /** 河流：CatmullRom 平滑后并入 4 个 LineSegments2 批次（线宽按 rank 分 4 档，与逐河渲染完全一致）。
   *  逐河 Line2 只作为拾取代理（不加入场景 → 不渲染），draw call 由 N 降到 4。 */
  private buildRiverBatch(items: Rec[], group: THREE.Group, L: LodConfig): void {
    const tiers: number[][] = [[], [], [], []]
    const tierMats: LineMaterial[] = []
    for (let t = 0; t < 4; t++) {
      const m = new LineMaterial({
        color: CAT_COLOR.river, linewidth: 1.1 + (t + 1) * 0.28,
        transparent: true, opacity: 0.62, depthWrite: false,
      })
      m.resolution.set(innerWidth, innerHeight)
      tierMats.push(m); this.lineMats.push(m)
    }
    for (const rec of items) {
      if (!rec.path || rec.path.length < 2) continue
      const pts = rec.path.map(([lon, lat]) => llToVec(lat, lon, this.radius(lat, lon) + 0.0025))
      let linePts = pts
      if (pts.length >= 3) {
        // 远景不必把每条河平滑成 200 点：控制点已足够密时直接抽样即可
        const target = Math.min(L.riverPts, pts.length * 10)
        if (target < pts.length) {
          const step = pts.length / target
          linePts = Array.from({ length: target }, (_, i) => pts[Math.min(pts.length - 1, Math.floor(i * step))])
        } else {
          const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5)
          linePts = curve.getPoints(target)
        }
      }
      const tier = Math.min(3, Math.max(0, (rec.rank ?? 2) - 1))
      const buf = tiers[tier]
      for (let i = 0; i + 1 < linePts.length; i++) {
        const a = linePts[i], b = linePts[i + 1]
        buf.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }
      // 拾取代理：Line2 不挂入场景（渲染跳过），pick() 显式收集
      const proxy = new Line2(new LineGeometry().setPositions(linePts.flatMap(v => [v.x, v.y, v.z])), tierMats[tier])
      proxy.userData.item = rec
      this.proxies.push(proxy)
    }
    for (let t = 0; t < 4; t++) {
      const buf = tiers[t]
      if (buf.length < 6) continue
      const batch = new LineSegments2(new LineSegmentsGeometry().setPositions(buf), tierMats[t])
      batch.raycast = () => {}        // 批次不参与射线拾取（代理负责）
      group.add(batch)
    }
  }

  /** 面要素批渲染：每类合并成 1 个填充网格 + 1 个边界 LineSegments（凹多边形耳切剖分、支持内洞）。
   *  拾取用经纬度点选（pickArea），按 bbox 预筛 + 射线法。 */
  private buildAreaBatch(cat: Cat, items: Rec[], group: THREE.Group, L: LodConfig): void {
    const fillPos: number[] = [], fillCol: number[] = []
    const edgePos: number[] = [], edgeCol: number[] = []
    const ringless: Rec[] = []
    const pushColors = (dst: number[], c: THREE.Color, vertices: number) => {
      for (let i = 0; i < vertices; i++) dst.push(c.r, c.g, c.b)
    }
    const span = (ring: [number, number][]) => {
      let w = 180, s = 90, e = -180, n = -90
      for (const p of ring) {
        if (p[0] < w) w = p[0]; if (p[0] > e) e = p[0]
        if (p[1] < s) s = p[1]; if (p[1] > n) n = p[1]
      }
      return { w, s, e, n, area: (e - w) * (n - s) }
    }
    for (const rec of items) {
      if (!rec.rings?.length) { ringless.push(rec); continue }   // 无环面要素退化为点标记（如洞庭湖）
      const color = new THREE.Color(areaColor(rec))
      // 远景只保留最大的若干环：气候有 2319 个碎面、流域有大量飞地，全画既慢又看不清
      let chosen = rec.rings.filter(r => r.length >= 3)
      if (chosen.length > L.maxRings) {
        chosen = chosen.map(r => ({ r, a: span(r).area })).sort((x, y) => y.a - x.a)
          .slice(0, L.maxRings).map(x => x.r)
      }
      let w = 180, s = 90, e = -180, n = -90
      let any = false
      for (const rawRing of chosen) {
        const b = span(rawRing)
        if (b.e - b.w > 300 && b.n - b.s > 160) continue    // 疑似包住全球的矩形环，跳过
        w = Math.min(w, b.w); e = Math.max(e, b.e); s = Math.min(s, b.s); n = Math.max(n, b.n)
        const ring = simplifyRing(rawRing, L.ringPts)
        const built = this.triangulateRing(rec, ring, 0.0018, this.lodLevel !== 'far')
        if (!built) continue
        // position/color 均为每顶点 3 个分量 → 顶点数 = 数组长度 / 3
        fillPos.push(...built.fill); pushColors(fillCol, color, built.fill.length / 3)
        if (L.edges) { edgePos.push(...built.edge); pushColors(edgeCol, color, built.edge.length / 3) }
        any = true
      }
      if (any) this.areaRecs.push({ rec, w, s, e, n })
      else ringless.push(rec)   // 点状或过小/无效环：退化为点标记（沼泽、洞庭湖等）
    }
    if (fillPos.length) {
      const subdiv = subdivideTriangles(fillPos, L.subdiv, fillCol)   // 长对角线细分贴球，颜色随顶点同步细分
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.Float32BufferAttribute(subdiv.pos, 3))
      geo.setAttribute('color', new THREE.Float32BufferAttribute(subdiv.colors, 3))
      geo.computeVertexNormals()
      // 水体面只做淡淡着色，避免掩盖卫星影像；专题面保持可辨识
      const fillOpacity: Partial<Record<Cat, number>> = {
        ocean: 0.10, bay: 0.13, gulf: 0.15, lake: 0.20,
        basin: 0.14, subbasin: 0.12, climate: 0.18, biome: 0.18, swamp: 0.22,
      }
      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xffffff, vertexColors: true,
        transparent: true, opacity: fillOpacity[cat] ?? 0.3,
        side: THREE.DoubleSide, depthWrite: false,
      }))
      fill.raycast = () => {}         // 面拾取走经纬度点选，避免每帧万级三角形求交
      group.add(fill)
    }
    if (edgePos.length) {
      const edgeGeo = new THREE.BufferGeometry()
      edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3))
      edgeGeo.setAttribute('color', new THREE.Float32BufferAttribute(edgeCol, 3))
      const outline = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
        color: 0xffffff, vertexColors: true, transparent: true,
        opacity: cat === 'ocean' ? 0.45 : 0.75, depthWrite: false,
      }))
      outline.raycast = () => {}
      group.add(outline)
    }
    if (ringless.length) {
      const pos = new Float32Array(ringless.length * 3)
      const col = new Float32Array(ringless.length * 3)
      ringless.forEach((r, i) => {
        const v = llToVec(r.lat, r.lon, this.radius(r.lat, r.lon) + 0.005)
        const c = new THREE.Color(areaColor(r))
        pos.set([v.x, v.y, v.z], i * 3); col.set([c.r, c.g, c.b], i * 3)
      })
      const pgeo = new THREE.BufferGeometry()
      pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      pgeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
      const points = new THREE.Points(pgeo, new THREE.PointsMaterial({
        size: 0.018, map: this.dot, vertexColors: true,
        transparent: true, opacity: 0.9, alphaTest: 0.05, depthWrite: false, sizeAttenuation: true,
      }))
      points.userData.items = ringless
      group.add(points)
    }
    // 拾取优先级：小而具体的面优先
    const PRI: Cat[] = ['lake', 'swamp', 'subbasin', 'basin', 'biome', 'climate', 'bay', 'gulf', 'ocean']
    this.areaRecs.sort((a, b) => PRI.indexOf(a.rec.cat) - PRI.indexOf(b.rec.cat))
  }

  /** 单个环的三角剖分（经纬度平面 + cosLat 拉伸），返回球面三角与边界顶点。 */
  private triangulateRing(rec: Rec, ring: [number, number][], lift = 0.0018, useHoles = true): { fill: number[]; edge: number[] } | null {
    const maxPts = 6000
    if (ring.length < 3 || ring.length > maxPts) return null // 超大环跳过（数据侧已切断跨日界线环）
    const holes = useHoles ? (rec.holes ?? []).filter(h => h.length >= 3 && h.length <= maxPts && pointInRing(h[0], ring)) : []
    const vr = (lat: number, lon: number) => llToVec(lat, lon, this.radius(lat, lon) + lift)
    let lat0 = 0
    for (const p of ring) lat0 += p[1]
    lat0 /= ring.length
    const kx = Math.cos(lat0 * Math.PI / 180)
    const flat: [number, number][] = []
    const v2: THREE.Vector2[] = []
    const addPath = (path: [number, number][]) => {
      const end = path.length > 1 && path[0][0] === path[path.length - 1][0] && path[0][1] === path[path.length - 1][1]
        ? path.length - 1 : path.length
      for (let i = 0; i < end; i++) {
        flat.push(path[i])
        v2.push(new THREE.Vector2(path[i][0] * kx, path[i][1]))
      }
    }
    addPath(ring)
    // contour 只放外环（triangulateShape 会把 holes 再拼在后面，索引须与 flat 顺序一致）
    const contourV2 = v2.slice()
    const holeV2: THREE.Vector2[][] = []
    for (const h of holes) { const before = v2.length; addPath(h); holeV2.push(v2.slice(before)) }
    const vecs = flat.map(([lon, lat]) => vr(lat, lon))
    const fill: number[] = []
    let faces: number[][] = []
    if (vecs.length >= 3) {
      try { faces = THREE.ShapeUtils.triangulateShape(contourV2, holeV2) } catch { faces = [] }
    }
    if (faces.length) {
      for (const f of faces) {
        const va = vecs[f[0]], vb = vecs[f[1]], vc = vecs[f[2]]
        if (!va || !vb || !vc) continue
        fill.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z)
      }
    } else {
      // 剖分失败兜底：质心三角扇
      let clon = 0, clat = 0
      for (const p of ring) { clon += p[0]; clat += p[1] }
      clon /= ring.length; clat /= ring.length
      const cv = vr(clat, clon)
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length]
        const va = vr(a[1], a[0]), vb = vr(b[1], b[0])
        fill.push(cv.x, cv.y, cv.z, va.x, va.y, va.z, vb.x, vb.y, vb.z)
      }
    }
    if (!fill.length) return null
    const edge: number[] = []
    const pushEdge = (path: [number, number][]) => {
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length]
        const va = vr(a[1], a[0]), vb = vr(b[1], b[0])
        edge.push(va.x, va.y, va.z, vb.x, vb.y, vb.z)
      }
    }
    pushEdge(ring)
    for (const h of holes) pushEdge(h)
    return { fill, edge }
  }

  private clear(): void {
    for (const g of this.groups.values()) {
      for (const child of [...g.children]) {
        g.remove(child)
        child.traverse?.(o => {
          const m = o as THREE.Mesh
          m.geometry?.dispose()
          const mat = m.material as THREE.Material | THREE.Material[]
          if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
        })
        const mm = child as THREE.Mesh
        mm.geometry?.dispose()
        const mat = mm.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose()
      }
    }
    for (const p of this.proxies) {
      p.geometry?.dispose()
      const mat = p.material as THREE.Material
      mat?.dispose()
    }
    this.proxies = []
    this.areaRecs = []
    this.lineMats = []
  }

  resize(): void { for (const m of this.lineMats) m.resolution.set(innerWidth, innerHeight) }

  /** 选中面要素时高亮整片多边形（而非仅质心金圈）；点/线要素仍用质心圈。 */
  setSelected(rec: Rec | null): void {
    this.selectionFill.geometry.dispose(); this.selectionEdge.geometry.dispose()
    this.selectionFill.geometry = new THREE.BufferGeometry()
    this.selectionEdge.geometry = new THREE.BufferGeometry()
    this.selectionFill.visible = this.selectionEdge.visible = false
    if (!rec) { this.selection.visible = false; return }
    const v = llToVec(rec.lat, rec.lon, this.radius(rec.lat, rec.lon) + 0.009)
    this.selection.position.copy(v)
    this.selection.lookAt(v.clone().multiplyScalar(2))
    this.selection.visible = true
    if (!rec.rings?.length) return
    const color = new THREE.Color(areaColor(rec))
    const fillPos: number[] = [], fillCol: number[] = [], edgePos: number[] = [], edgeCol: number[] = []
    const L = LOD[this.lodLevel]
    for (const ring of rec.rings) {
      const built = this.triangulateRing(rec, simplifyRing(ring, L.ringPts), 0.0045)
      if (!built) continue
      fillPos.push(...built.fill)
      for (let i = 0; i < built.fill.length / 9; i++) for (let k = 0; k < 3; k++) fillCol.push(color.r, color.g, color.b)
      edgePos.push(...built.edge)
      for (let i = 0; i < built.edge.length / 6; i++) for (let k = 0; k < 2; k++) edgeCol.push(color.r, color.g, color.b)
    }
    if (!fillPos.length) return
    const sub = subdivideTriangles(fillPos, L.subdiv, fillCol)
    this.selectionFill.geometry = new THREE.BufferGeometry()
    this.selectionFill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sub.pos, 3))
    this.selectionFill.geometry.setAttribute('color', new THREE.Float32BufferAttribute(sub.colors, 3))
    this.selectionEdge.geometry = new THREE.BufferGeometry()
    this.selectionEdge.geometry.setAttribute('position', new THREE.Float32BufferAttribute(edgePos, 3))
    this.selectionEdge.geometry.setAttribute('color', new THREE.Float32BufferAttribute(edgeCol, 3))
    this.selectionFill.visible = this.selectionEdge.visible = true
  }

  /** 全图自检：逐图层返回数据条数、已绘制对象数与开关状态。 */
  audit(): Record<string, { total: number; drawn: number; visible: boolean }> {
    const out: Record<string, { total: number; drawn: number; visible: boolean }> = {}
    for (const [cat, g] of this.groups) {
      out[cat] = {
        total: this.all.filter(r => r.cat === cat).length,
        drawn: g.children.length,
        visible: this.enabled.has(cat),
      }
    }
    return out
  }

  pick(ray: THREE.Raycaster, camera: THREE.Camera): Rec | null {
    const objs: THREE.Object3D[] = []
    for (const [c, g] of this.groups) if (this.enabled.has(c)) objs.push(...g.children)
    if (this.enabled.has('river')) objs.push(...this.proxies)   // 逐河代理：渲染外的拾取目标
    ray.params.Points = { threshold: 0.01 }
    const hits = ray.intersectObjects(objs, true)
    const camDir = camera.position.clone().normalize()
    for (const h of hits) {
      // 背面剔除：点在球体背向相机的一侧时忽略（射线会穿过球击中点背面要素）
      const p = h.point.clone().normalize()
      if (p.dot(camDir) < 0.15) continue
      if (h.object.userData.item) return h.object.userData.item as Rec
      if (h.object instanceof THREE.Points && h.index !== undefined) {
        const items = h.object.userData.items as Rec[] | undefined
        if (items?.[h.index]) return items[h.index]
      }
    }
    // 面要素（湖泊/海域/流域）：射线与球面求交 → 经纬度点选（bbox 预筛 + 射线法）
    return this.pickArea(ray, camDir)
  }

  private pickArea(ray: THREE.Raycaster, camDir: THREE.Vector3): Rec | null {
    if (!this.areaRecs.length) return null
    const hp = ray.ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), new THREE.Vector3())
    if (!hp) return null
    if (hp.clone().normalize().dot(camDir) < 0.15) return null   // 背面剔除
    const lat = Math.asin(Math.max(-1, Math.min(1, hp.y))) * 180 / Math.PI
    const lon = Math.atan2(-hp.z, hp.x) * 180 / Math.PI
    const p: [number, number] = [lon, lat]
    for (const { rec, w, s, e, n } of this.areaRecs) {
      if (lon < w - 0.5 || lon > e + 0.5 || lat < s - 0.5 || lat > n + 0.5) continue
      let insideOuter = false
      for (const ring of rec.rings!) { if (pointInRing(p, ring)) { insideOuter = true; break } }
      if (!insideOuter) continue
      let inHole = false
      for (const h of rec.holes ?? []) { if (pointInRing(p, h)) { inHole = true; break } }
      if (!inHole) return rec
    }
    return null
  }
}
