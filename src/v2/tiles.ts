import * as THREE from 'three'
import { D2R, clamp } from './config2'

/**
 * 近景影像层：使用 ESRI World Imagery 分级瓦片（tile/{z}/{y}/{x}，单块约 150ms）拼接，
 * 取代单次 8–14 秒的 export 请求。视野按瓦片边界量化 → 只有瓦片集合变化才重新拉取，
 * 拖动手感接近 Google Earth；远景仍由 8K 全球烘焙影像呈现。
 */
const TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile'
const TILE = 256

interface ViewImage { mesh: THREE.Mesh; key: string }

function lonToX(lon: number, z: number): number {
  return Math.floor((lon + 180) / 360 * (2 ** z))
}
function latToY(lat: number, z: number): number {
  const n = 2 ** z
  const r = clamp(lat, -85.05112878, 85.05112878) * Math.PI / 180
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n)
}
function xToLon(x: number, z: number): number { return x / (2 ** z) * 360 - 180 }
function yToLat(y: number, z: number): number {
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (2 ** z)))) * 180 / Math.PI
}

export class TileLayer {
  private group = new THREE.Group()
  private current: ViewImage | null = null
  private tileCache = new Map<string, HTMLImageElement>()
  private canvas = document.createElement('canvas')
  private ctx = this.canvas.getContext('2d')!
  private inflight = false
  private lastKey = ''
  private timer = 0
  active = true

  constructor(scene: THREE.Scene) {
    this.group.name = 'view-image-layer'
    scene.add(this.group)
  }

  /** 视野半角（度）：dist=1.005→5.7°, 1.02→11.4°, 1.5→48°。 */
  private viewHalfAngle(dist: number): number {
    return Math.acos(Math.min(1, 1 / dist)) * 180 / Math.PI
  }

  update(_camera: THREE.Camera, centerLat: number, centerLon: number, dist: number): void {
    if (!this.active || dist > 1.6) { this.group.visible = false; return }
    this.group.visible = true

    const half = this.viewHalfAngle(dist)
    const aspect = Math.min(2.2, innerWidth / innerHeight)
    const dLon = Math.min(60, half * aspect * 1.15)
    const dLat = Math.min(60, half * 1.15)
    let west = centerLon - dLon, east = centerLon + dLon
    let north = Math.min(85, centerLat + dLat), south = Math.max(-85, centerLat - dLat)
    if (west < -180 || east > 180) {
      const c = ((centerLon + 180) % 360 + 360) % 360 - 180
      west = Math.max(-180, c - dLon); east = Math.min(180, c + dLon)
    }
    if (east - west < 0.005 || north - south < 0.005) return

    // 选 zoom：视野跨度约覆盖 10 张瓦片，上限 196 张（瓦片约 150ms 且可并行，换来更高分辨率）
    let z = clamp(Math.round(Math.log2(360 / Math.max(0.01, (east - west) / 10))), 3, 13)
    let x0 = lonToX(west, z), x1 = lonToX(east, z)
    let y0 = latToY(north, z), y1 = latToY(south, z)
    while ((x1 - x0 + 1) * (y1 - y0 + 1) > 196 && z > 3) {
      z--
      x0 = lonToX(west, z); x1 = lonToX(east, z)
      y0 = latToY(north, z); y1 = latToY(south, z)
    }
    const key = `${z}/${x0}/${x1}/${y0}/${y1}`
    if (key === this.lastKey || this.inflight) return
    this.lastKey = key

    const qWest = xToLon(x0, z), qEast = xToLon(x1 + 1, z)
    const qNorth = yToLat(y0, z), qSouth = yToLat(y1 + 1, z)
    clearTimeout(this.timer)
    this.timer = window.setTimeout(
      () => void this.loadTiles(z, x0, x1, y0, y1, qWest, qEast, qNorth, qSouth, key), 120,
    )
  }

  private loadTile(z: number, x: number, y: number): Promise<void> {
    const key = `${z}/${x}/${y}`
    const cached = this.tileCache.get(key)
    if (cached) return Promise.resolve()
    return new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { this.tileCache.set(key, img); resolve() }
      img.onerror = () => resolve()          // 单块失败留空，不影响其余瓦片
      img.src = `${TILE_URL}/${z}/${y}/${x}`
    })
  }

  private async loadTiles(
    z: number, x0: number, x1: number, y0: number, y1: number,
    west: number, east: number, north: number, south: number, key: string,
  ): Promise<void> {
    this.inflight = true
    try {
      const tasks: Promise<void>[] = []
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tasks.push(this.loadTile(z, x, y))
      await Promise.all(tasks)
      const w = (x1 - x0 + 1) * TILE, h = (y1 - y0 + 1) * TILE
      this.canvas.width = w; this.canvas.height = h
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const img = this.tileCache.get(`${z}/${x}/${y}`)
        if (img) this.ctx.drawImage(img, (x - x0) * TILE, (y - y0) * TILE, TILE, TILE)
      }
      const tex = new THREE.CanvasTexture(this.canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.magFilter = THREE.LinearFilter
      tex.needsUpdate = true
      const mesh = this.buildPatch(west, east, north, south, tex)
      if (this.current) {
        this.group.remove(this.current.mesh)
        this.current.mesh.geometry.dispose()
        const m = this.current.mesh.material as THREE.MeshBasicMaterial
        m.map?.dispose(); m.dispose()
      }
      this.group.add(mesh)
      this.current = { mesh, key }
    } finally {
      this.inflight = false
    }
  }

  private buildPatch(
    west: number, east: number, north: number, south: number, tex: THREE.Texture,
  ): THREE.Mesh {
    const SEG = 48
    const positions: number[] = [], uvs: number[] = [], indices: number[] = []
    const R = 1.0015
    for (let j = 0; j <= SEG; j++) {
      const v = j / SEG
      const lat = north + (south - north) * v
      for (let i = 0; i <= SEG; i++) {
        const u = i / SEG
        const lon = west + (east - west) * u
        const la = lat * D2R, lo = lon * D2R
        positions.push(R * Math.cos(la) * Math.cos(lo), R * Math.sin(la), -R * Math.cos(la) * Math.sin(lo))
        uvs.push(u, 1 - v)
      }
    }
    for (let j = 0; j < SEG; j++) {
      for (let i = 0; i < SEG; i++) {
        const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(indices)
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }))
  }

  dispose(): void {
    if (this.current) {
      this.current.mesh.geometry.dispose()
      const m = this.current.mesh.material as THREE.MeshBasicMaterial
      m.map?.dispose(); m.dispose()
    }
    this.group.clear()
  }
}
