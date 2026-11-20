import * as THREE from 'three'
import { EARTH_R, BASE, D2R, R2D, clamp } from './config2'
import { TileLayer } from './tiles'

/** ImageBitmap → HTMLCanvasElement：CanvasTexture 对 canvas 源的 flipY 才会生效，避免南北颠倒。 */
function bitmapToCanvas(bmp: ImageBitmap): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = bmp.width; c.height = bmp.height
  c.getContext('2d')!.drawImage(bmp, 0, 0)
  return c
}

/** 地球渲染：高分段球体、浮雕/卫星纹理、DEM 位移。 */
export class GlobeView2 {
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly earth: THREE.Mesh
  readonly clouds: THREE.Mesh
  private grid: THREE.Group
  private reliefBmp: ImageBitmap | null = null
  private satelliteBmp: ImageBitmap | null = null
  exaggeration = 3
  private dem: (lat: number, lon: number) => number
  readonly tiles: TileLayer

  constructor(canvas: HTMLCanvasElement, demSampler: (lat: number, lon: number) => number) {
    this.dem = demSampler
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.setSize(innerWidth, innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.001, 200)
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.9))
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.2); sun.position.set(-4, 3, 5); this.scene.add(sun)
    const fill = new THREE.DirectionalLight(0x93b8cc, 0.45); fill.position.set(5, -2, -4); this.scene.add(fill)

    const loader = new THREE.TextureLoader()
    const initial = loader.load(BASE + 'textures/day.jpg')
    initial.colorSpace = THREE.SRGBColorSpace
    initial.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy())
    const geo = new THREE.SphereGeometry(EARTH_R, 512, 256)
    const colors = new Float32Array(geo.attributes.position.count * 3).fill(1)
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.earth = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: initial, vertexColors: true, roughness: 0.95, metalness: 0,
    }))
    this.scene.add(this.earth)

    const cloudTex = loader.load(BASE + 'textures/clouds.png')
    cloudTex.colorSpace = THREE.SRGBColorSpace
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R * 1.012, 96, 64),
      new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, opacity: 0.28, depthWrite: false }),
    )
    this.scene.add(this.clouds)
    this.grid = this.buildGrid(); this.grid.visible = false; this.scene.add(this.grid)
    this.scene.add(this.buildStars())
    this.tiles = new TileLayer(this.scene)
    // 瓦片模式下用标准球，避免地形位移导致瓦片穿模；地形立体感由卫星影像自身阴影体现。
    this.exaggeration = 0
    this.applyTerrain()
  }

  setSurface(kind: 'relief' | 'satellite', bmp: ImageBitmap): void {
    if (kind === 'relief') this.reliefBmp = bmp; else this.satelliteBmp = bmp
  }
  private makeTexture(source: HTMLCanvasElement | HTMLImageElement): THREE.Texture {
    const tex = new THREE.Texture(source)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy())
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.flipY = true
    tex.needsUpdate = true
    return tex
  }
  showSurface(kind: 'relief' | 'satellite'): void {
    const bmp = kind === 'relief' ? this.reliefBmp : this.satelliteBmp
    if (!bmp) return
    const mat = this.earth.material as THREE.MeshStandardMaterial
    const old = mat.map
    mat.map = this.makeTexture(bitmapToCanvas(bmp))
    mat.needsUpdate = true
    if (old && old !== mat.map) old.dispose()
  }

  private buildGrid(): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.LineBasicMaterial({ color: 0xc9a86b, transparent: true, opacity: 0.14, depthWrite: false })
    for (let lat = -75; lat <= 75; lat += 15) {
      const pts: THREE.Vector3[] = []
      for (let lon = -180; lon <= 180; lon += 3) pts.push(this.spherePoint(lat, lon, 1.016))
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat))
    }
    for (let lon = -180; lon < 180; lon += 15) {
      const pts: THREE.Vector3[] = []
      for (let lat = -90; lat <= 90; lat += 3) pts.push(this.spherePoint(lat, lon, 1.016))
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat))
    }
    return g
  }
  private spherePoint(lat: number, lon: number, r: number): THREE.Vector3 {
    const la = lat * D2R, lo = lon * D2R
    return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo))
  }
  private buildStars(): THREE.Points {
    const n = 2200, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(35 + Math.random() * 30)
      pos.set([v.x, v.y, v.z], i * 3)
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xa8b6bd, size: 0.1, sizeAttenuation: true }))
  }
  applyTerrain(): void {
    const geo = this.earth.geometry as THREE.BufferGeometry
    const pos = geo.attributes.position as THREE.BufferAttribute
    const unit = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      unit.fromBufferAttribute(pos, i).normalize()
      const lat = Math.asin(clamp(unit.y, -1, 1)) * R2D
      const lon = Math.atan2(-unit.z, unit.x) * R2D
      const elev = this.dem(lat, lon)
      const r = 1 + Math.max(elev, 0) / 9000 * 0.04 * this.exaggeration
      pos.setXYZ(i, unit.x * r, unit.y * r, unit.z * r)
    }
    pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere()
  }
  updateTiles(centerLat: number, centerLon: number, dist: number): void {
    this.tiles.update(this.camera, centerLat, centerLon, dist)
  }
  setTilesActive(on: boolean): void { this.tiles.active = on }
  setExaggeration(v: number): void { this.exaggeration = v; this.applyTerrain() }
  setClouds(on: boolean): void { this.clouds.visible = on }
  setGrid(on: boolean): void { this.grid.visible = on }
  resize(): void { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight) }
  render(): void { this.clouds.rotation.y += 0.00005; this.renderer.render(this.scene, this.camera) }
}
