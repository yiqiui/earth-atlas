/**
 * 构建时生成全球静态底图：
 *  1) 从 natural-earth-vector 拉取 50m 矢量数据，简化为 GeoJSON；
 *  2) 从 AWS Terrarium 高程瓦片拼接全球 8-bit 高程图 dem.png。
 * 数据为公有领域 / 开放数据，来源见 README。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'data', 'base')
fs.mkdirSync(outDir, { recursive: true })

const API = 'https://api.github.com/repos/nvkelso/natural-earth-vector/contents/geojson/'
const NE_FILES = [
  ['land.json', 'ne_50m_land.geojson'],
  ['rivers.json', 'ne_50m_rivers_lake_centerlines.geojson'],
  ['lakes.json', 'ne_50m_lakes.geojson'],
  ['oceans.json', 'ne_50m_ocean.geojson'],
  ['marine.json', 'ne_50m_geography_marine_polys.geojson'],
  ['places.json', 'ne_50m_geography_regions_elevation_points.geojson'],
  ['regions.json', 'ne_50m_geography_regions_polys.geojson'],
  ['islands.json', 'ne_10m_minor_islands_label_points.geojson'],
]

async function fetchWithRetry(url, options = {}, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, options)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      last = e
      await new Promise(r => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw last
}

function roundCoord(c) {
  if (typeof c === 'number') return Math.round(c * 1000) / 1000
  if (Array.isArray(c)) return c.map(roundCoord)
  return c
}

function simplifyGeometry(geometry) {
  if (!geometry) return geometry
  return { type: geometry.type, coordinates: roundCoord(geometry.coordinates) }
}

async function fetchNaturalEarth() {
  for (const [outName, remoteName] of NE_FILES) {
    process.stdout.write(`拉取 ${remoteName} ... `)
    try {
      const res = await fetchWithRetry(API + remoteName, {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'earth-atlas-build',
        },
      })
      const fc = await res.json()
      const features = (fc.features || []).map(f => ({
        type: 'Feature',
        id: f.id ?? f.properties?.FID ?? undefined,
        properties: f.properties || {},
        geometry: simplifyGeometry(f.geometry),
      }))
      // 岛屿点集显式标记类别，便于归一化识别
      if (outName === 'islands.json') {
        for (const f of features) f.properties.cat = 'island'
      }
      fs.writeFileSync(path.join(outDir, outName), JSON.stringify({ type: 'FeatureCollection', features }))
      console.log(`${features.length} 个要素`)
    } catch (e) {
      console.log(`失败：${e.message}（跳过，可稍后重跑）`)
    }
  }
}

/* ---------------- 极简 PNG 解码（Terrarium 瓦片为 8-bit RGB/RGBA） ---------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function decodePng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('不是 PNG')
  let pos = 8, width = 0, height = 0, colorType = 2, bitDepth = 8
  const idat = []
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const data = buf.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      if (bitDepth !== 8) throw new Error('仅支持 8-bit PNG')
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += len + 12
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1
  const bpp = channels
  const stride = width * bpp
  const inflated = zlib.inflateSync(Buffer.concat(idat))
  const out = Buffer.alloc(height * stride)
  let p = 0
  for (let y = 0; y < height; y++) {
    const filter = inflated[p++]
    for (let x = 0; x < stride; x++) {
      const raw = inflated[p++]
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const b = y > 0 ? out[(y - 1) * stride + x] : 0
      const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0
      let v
      if (filter === 0) v = raw
      else if (filter === 1) v = raw + a
      else if (filter === 2) v = raw + b
      else if (filter === 3) v = raw + Math.floor((a + b) / 2)
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c)
        v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)
      } else v = raw
      out[y * stride + x] = v & 255
    }
  }
  return { width, height, channels, data: out }
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodeGrayPng(width, height, gray) {
  const sig = Buffer.from('89504e470d0a1a0a', 'hex')
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 0   // grayscale
  const raw = Buffer.alloc((width + 1) * height)
  for (let y = 0; y < height; y++) {
    gray.copy(raw, y * (width + 1) + 1, y * width, (y + 1) * width)
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

async function buildDem() {
  const zoom = 3
  const tiles = 2 ** zoom
  const tileSize = 256
  const size = tiles * tileSize
  const gray = Buffer.alloc(size * size)
  console.log(`拼接全球 DEM：z=${zoom}，${tiles}×${tiles} 瓦片，${size}×${size} 像素`)

  const jobs = []
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) jobs.push([tx, ty])
  }
  let done = 0, failed = 0
  async function worker() {
    while (jobs.length) {
      const [tx, ty] = jobs.shift()
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${tx}/${ty}.png`
      try {
        const res = await fetchWithRetry(url)
        const img = decodePng(Buffer.from(await res.arrayBuffer()))
        for (let y = 0; y < img.height; y++) {
          for (let x = 0; x < img.width; x++) {
            const p = (y * img.width + x) * img.channels
            const elev = img.data[p] * 256 + img.data[p + 1] + img.data[p + 2] / 256 - 32768
            const v = Math.max(0, Math.min(255, Math.round((elev + 500) / 9500 * 255)))
            gray[(ty * tileSize + y) * size + (tx * tileSize + x)] = v
          }
        }
      } catch {
        failed++
      }
      done++
      if (done % 16 === 0) process.stdout.write(`  ${done}/${tiles * tiles}\n`)
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  fs.writeFileSync(path.join(outDir, 'dem.png'), encodeGrayPng(size, size, gray))
  console.log(`DEM 完成：dem.png (${(gray.length / 1024 / 1024).toFixed(1)} MB 原始)，失败瓦片 ${failed}`)
}

await fetchNaturalEarth()
await buildDem()
console.log('静态底图生成完毕')
