# 渲染自适应 LOD 优化

> Status: Done
> Created: 2026-11-20

## 1. Background & Goal
全图层开启时 `renderer.info` 达 320 万三角形 / 24 万线段（河流第 4 档单批 26.7 万实例，面细分 maxLen=0.05 产生数十万三角形），CPU 帧耗时仅 7ms，瓶颈为 GPU 渲染与透明叠加。目标：远景大幅降载，近景保持细节。

## 2. Scope
### In Scope
- `features3.ts` 按相机距离分 far/mid/near 三档，带滞回，仅档位切换时重建。
- 远景：河流曲线采样 200→24 点；面环点数上限 6000→120；细分阈值 0.05→0.22；不绘制面边界线。
- 中景：60 点 / 600 点 / 0.10 / 保留边界。
- 近景：保持 200 点 / 6000 点 / 0.05 / 保留边界。
- `main8.tick()` 调用 `features.setLod()`；`__atlas2.perf()` 暴露档位与渲染统计。
### Out of Scope
- 影像瓦片、DEM、标签布局的改动。
- 改变数据内容或默认勾选状态。

## 3. Design
- `lodFor(dist)`：far ≥2.6、mid 1.35–2.4、near ≤1.3，中间区间保持原档（滞回）。
- `simplifyRing(ring, max)`：等距抽样并保留闭合点。
- 顶点色缓冲与 position 严格同步（1 顶点 = 3 分量）。
- 选中高亮同样使用当前档细分阈值。

## 4. File-level change list
| File | Action | Description |
|------|--------|-------------|
| `src/v2/features3.ts` | modify | LOD 状态、采样/细分/边界裁剪、perf 出口 |
| `src/v2/main8.ts` | modify | tick 调用 setLod；__atlas2.perf() |
| `docs/plans/teaching-atlas-v2.md` | modify | 迭代记录 |

## 5. Test plan
- 同一视野下 far 档三角形数应显著低于 near 档；切回 near 后细节点数恢复。
- 全图层 + 流域加载后切换 6 大洲视野，检查无 JS 错误、无 NaN 顶点。
- `tsc` / `vitest` / `vite build` 全绿。

## 6. Rollback
保留 `LOD.near` 作为全量精度；若 LOD 引起视觉跳变，可将阈值改为只降 riverPts。

## 7. Risks
- 档位切换有一次重建耗时（约 100–300ms），用滞回避免频繁切换。
- 远景面简化可能让极小海湾退化；保留点标记兜底。
