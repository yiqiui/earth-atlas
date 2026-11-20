export type LodLevel = 'far' | 'mid' | 'near'
export interface LodConfig {
  riverPts: number      // 河流 CatmullRom 采样点数上限
  ringPts: number       // 单个面环保留的点数上限
  maxRings: number      // 单个要素保留的环数上限（远景跳过小碎面）
  subdiv: number        // 填充三角形长边细分阈值
  edges: boolean        // 是否绘制面边界线
}

export const LOD: Record<LodLevel, LodConfig> = {
  far: { riverPts: 24, ringPts: 120, maxRings: 24, subdiv: 0.22, edges: false },
  mid: { riverPts: 40, ringPts: 600, maxRings: 120, subdiv: 0.14, edges: true },
  near: { riverPts: 80, ringPts: 6000, maxRings: Infinity, subdiv: 0.10, edges: true },
}

/** 带滞回的档位选择：避免临界距离附近反复重建。 */
export function lodFor(dist: number, prev: LodLevel): LodLevel {
  if (prev === 'far') return dist < 2.2 ? (dist < 1.3 ? 'near' : 'mid') : 'far'
  if (prev === 'mid') return dist >= 2.6 ? 'far' : (dist <= 1.3 ? 'near' : 'mid')
  return dist >= 2.6 ? 'far' : (dist > 1.45 ? 'mid' : 'near')
}

/** 等距抽样简化环（保留闭合点），远景面不必保留数千顶点。 */
export function simplifyRing(ring: [number, number][], max: number): [number, number][] {
  if (ring.length <= max) return ring
  const closed = ring.length > 2 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
  const body = closed ? ring.slice(0, -1) : ring
  const step = body.length / max
  const out: [number, number][] = []
  for (let i = 0; i < max; i++) out.push(body[Math.min(body.length - 1, Math.floor(i * step))])
  if (closed) out.push(out[0])
  return out
}
