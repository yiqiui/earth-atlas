import * as THREE from 'three'
import { CAT_MIN_DIST, type Cat } from './config'
import { lang, catLabel } from './i18n2'
import type { Rec } from './data4'

const PRIORITY: Record<Cat, number> = {
  ocean: 0, gulf: 0, bay: 0, strait: 1, land: 2, basin: 2, range: 3, river: 3, lake: 4,
  island: 5, peak: 6, cape: 7, fjord: 7, current: 7, trail: 8, climate: 9, biome: 9,
  subbasin: 2, swamp: 8,
}

export class LabelLayer3 {
  private els: { rec: Rec; el: HTMLDivElement }[] = []
  private enabled = new Set<Cat>()

  constructor(private host: HTMLElement, private radius: (lat: number, lon: number) => number) {}

  setEnabled(cats: Set<Cat>) { this.enabled = cats }

  setFeatures(records: Rec[]): void {
    this.host.replaceChildren()
    this.els = []
    const byCat = new Map<Cat, Rec[]>()
    for (const r of records) {
      const arr = byCat.get(r.cat) ?? []; arr.push(r); byCat.set(r.cat, arr)
    }
    const chosen: Rec[] = []
    for (const [, arr] of byCat) {
      // 同名去重（海域尤其重要：多个"南海""东海"只留一个）
      const seen = new Set<string>()
      const unique = arr.filter(r => {
        if (seen.has(r.name)) return false
        seen.add(r.name); return true
      })
      unique.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
      // 不再按 PER_CAT 限额：生成全部标签 DOM，由 update 按缩放/视野动态显示
      chosen.push(...unique)
    }
    chosen.sort((a, b) => PRIORITY[a.cat] - PRIORITY[b.cat] || (a.rank ?? 99) - (b.rank ?? 99))
    for (const rec of chosen) {
      const el = document.createElement('div')
      el.className = `label3 ${rec.cat}`
      el.textContent = rec.names[lang()] || rec.nameEn || rec.name
      el.title = catLabel(rec.cat)
      this.host.appendChild(el)
      this.els.push({ rec, el })
    }
  }

  update(camera: THREE.Camera, dist: number): void {
    const cam = camera.position.clone().normalize()
    const v = new THREE.Vector3()
    const occupied: { x: number; y: number }[] = []
    // 越贴近( dist 小 )碰撞阈值越小 → 更多标签能同时显示
    const minSep = dist <= 1.3 ? 26 : dist <= 2 ? 46 : 70
    for (const { rec, el } of this.els) {
      if (!this.enabled.has(rec.cat)) { el.style.display = 'none'; continue }
      // LOD：远景(maxDist)时隐藏次要类别；放大后(dist变小)所有类别都显示
      const maxDist = CAT_MIN_DIST[rec.cat] ?? 9
      if (dist > maxDist) { el.style.display = 'none'; continue }
      const la = rec.lat * Math.PI / 180, lo = rec.lon * Math.PI / 180
      v.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo))
      const rr = this.radius(rec.lat, rec.lon) + 0.006
      v.multiplyScalar(rr)
      if (v.clone().normalize().dot(cam) < 0.18) { el.style.display = 'none'; continue }
      const p = v.clone().project(camera)
      if (p.z > 1 || Math.abs(p.x) > 1.05 || Math.abs(p.y) > 1.05) { el.style.display = 'none'; continue }
      const x = (p.x * 0.5 + 0.5) * innerWidth
      const y = (-p.y * 0.5 + 0.5) * innerHeight
      if (occupied.some(o => Math.abs(o.x - x) < minSep && Math.abs(o.y - y) < minSep * 0.35)) { el.style.display = 'none'; continue }
      occupied.push({ x, y })
      el.style.display = 'block'
      el.style.left = `${x}px`
      el.style.top = `${y}px`
      el.style.opacity = String(Math.min(1, Math.max(0.4, (v.clone().normalize().dot(cam) - 0.15) * 3)))
    }
  }
}
