/** 搜索框经纬度解析：支持 `39.9,116.4`、`39.9 116.4`、`N39.9 E116.4`。 */
export function parseCoordQuery(q: string): { lat: number; lon: number } | null {
  const s = q.replace(/[°]/g, '').trim()
  const m = s.match(/^([NS])?\s*(-?\d+(?:\.\d+)?)\s*[,，\s]+\s*([EW])?\s*(-?\d+(?:\.\d+)?)$/i)
  if (!m) return null
  let lat = Number(m[2]), lon = Number(m[4])
  if (m[1]?.toUpperCase() === 'S') lat = -lat
  if (m[3]?.toUpperCase() === 'W') lon = -lon
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  return { lat, lon }
}
