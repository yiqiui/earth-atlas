# 清晰度 / 分类配色 / 全要素详情

> Status: Done
> Created: 2026-11-20

## 1. Background & Goal
近景影像来自 `MapServer/export` 单次请求（实测 8–14 秒），镜头移动时始终是过期低清贴图；19 个图层中水系类颜色相近且面填充偏灰；全库约 4000 个要素中超过一半没有任何 `desc`/`facts`，点击只显示名称。目标：近景达到瓦片级清晰、每类地貌一眼可辨、任意要素点击都有可用详情。

## 2. Scope
### In Scope
- `tiles.ts`：用 `World_Imagery/MapServer/tile/{z}/{y}/{x}` 分级瓦片替换 export；按视距选 zoom，按瓦片边界量化视野，8×8 瓦片并行拼贴到 canvas 纹理并缓存；保留远景 8K 全球影像。
- `config2.ts`：19 类语义化配色（水系分蓝/青/紫、陆地暖色、专题色区分），避免同类蓝。
- `features3.ts`：面填充不透明度 0.38、边界 0.85，提高辨识度。
- 新增 `teaching.ts`：`ensureDetail(rec, ctx)` 为无描述要素生成类别科普段落 + 事实表（坐标、海拔、气候带、所属流域、附近地貌），不编造具体面积/长度数字。
- `main8.showDetail()` 调用生成器；`__atlas2` 暴露 `detailStats()`。
### Out of Scope
- 逐条要素的考据式百科描述（仅模板 + 本地真实数据）。
- 影像源更换（仍为 ESRI World Imagery，仅改用瓦片接口）。
- 标签布局重做。

## 3. Design
- zoom 选择：使视野跨度约覆盖 8 张瓦片，`z = clamp(round(log2(360 / (spanLon / 8))), 3, 13)`，超过 12×12 张时降一级。
- 瓦片坐标：Web Mercator 标准 `x=(lon+180)/360·2^z`，`y=(1-ln(tan φ+sec φ)/π)/2·2^z`。
- 补丁边界量化到整张瓦片，缓存键 `z/xmin/xmax/ymin/ymax`；只有瓦片集合变化才重新拉取。
- 详情生成：仅在 `!rec.desc || !rec.facts?.length` 时填充；按 cat 使用不同科普模板，数值只用已有本地数据（坐标/DEM 海拔/Köppen 气候带/流域/最近要素）。

## 4. File-level change list
| File | Action | Description |
|------|--------|-------------|
| `src/v2/tiles.ts` | modify | 瓦片拼贴影像层 |
| `src/v2/config2.ts` | modify | 19 类配色 |
| `src/v2/features3.ts` | modify | 面填充/边界对比度 |
| `src/v2/teaching.ts` | create | 详情生成器 |
| `src/v2/main8.ts` | modify | showDetail 接入；detailStats 出口 |
| `src/v2/teaching.test.ts` | create | 所有类别都能生成中文详情 |
| `docs/plans/teaching-atlas-v2.md` | modify | 迭代记录 |

## 5. Test plan
- 瓦片：近景等待 <1s 后 canvas 纹理区域非空白；跨 180° 不报错。
- 配色：19 类色值两两不同；水系类色相分散。
- 详情：模拟各类别 Rec 调 `ensureDetail()`，断言 desc 非空、facts ≥4 项、无拉丁描述。
- `tsc` / `vitest` / `vite build` 全绿。

## 6. Rollback
瓦片层失败时回退现有 export patch；配色可回退单一色表；详情生成器只在缺失时填充，不影响已有 curated 描述。

## 7. Risks
- 瓦片服务按量限制：需缓存 + 量化视野防止频繁请求。
- 通用描述为教学示意，不应被误认为逐条考据；文案中明确标注。
