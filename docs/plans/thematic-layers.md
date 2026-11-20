# 专题图层扩展设计（流域分色 / 气候 / 全勾选生效）

> Status: Done
> Created: 2026-11-20

## 1. Background & Goal

当前界面有 17 个图层勾选框，但只有 10 类真正有数据：流域面整批单色无法区分，点击只在质心画金圈；`climate / biome / current / fjord` 勾选框没有数据；`swamp` 完全没有入口。地形夸张滑块会强制关闭影像、干扰 🌐 按钮；搜索不支持经纬度。

目标：让每个勾选项都真实生效且互不干扰；流域与子流域按要素分色、点击高亮整片并展示课本级详情（面积/占父流域比例/流量精选值/气候带）；气候带按类型分色；补齐洋流、植被、峡湾、沼泽数据；修复地形夸张与影像开关的耦合；支持 `纬度,经度` 搜索；提供全图自检出口。

## 2. Scope

### In Scope
- 合并 `config.ts` / `config2.ts` 的颜色与图层定义，统一为单一数据源。
- 面要素按要素着色（per-vertex color）：流域、子流域、气候带、植被带；其余面类保持类色。
- 新增 `subbasin`（子流域）、`swamp`（沼泽）两个 Cat；补齐 13 语言词条。
- 流域详情：面积、占父流域比例/面积排名、精选年径流量、气候带、范围描述；无权威流量数据时显式标注。
- 点击流域/子流域/气候带：整片多边形高亮（而非质心圈）+ 详情面板。
- `WaterProvince / watprovID` 生成子流域；HydroSHEDS v2 `HYBAS_ID` 作为双轨实验，服务不可用时优雅降级。
- 生成并加载 `climate.json / biomes.json / currents.json`；新增精选 `fjords.json / swamps.json`。
- 修地形夸张与影像开关隔离；坐标搜索；状态栏增加海拔；`window.__atlas2.audit()` 全图自检。
- 新增单元测试覆盖颜色、分组、坐标解析、图层隔离、数据完整性。

### Out of Scope
- 严格水文意义上的「支流流域」自动定名（HydroSHEDS 无名称字段，子流域名按 WaterProvince 地名翻译 + 示意标注）。
- 逐条河流的权威流量在线服务（无可达数据源；仅精选大流域给课本数值）。
- 沼泽/峡湾的全球面数据（仅精选示例点/线）。
- 重做影像瓦片或离线烘焙流程。

## 3. Design

### 3.1 Architecture / Data flow

```
config2.ts (唯一数据源: Cat/颜色/图层/尺寸)
   ↑ re-export
config.ts
   │
data4.ts ── FILES 增加 climate/biomes/currents/fjords/swamps
   │  Rec{ cat, zone, temp, facts, rings, path }
   ▼
features3.ts ── AREA_CATS += climate/biome/subbasin/swamp
   ├─ buildAreaBatch(): colorForRec() → 顶点色缓冲
   ├─ buildLineBatch(): current/fjord 按 temp/类别着色
   └─ setSelected(): triangulateRing() → 高亮 mesh
   ▲
main8.ts ── onToggleCat / onExaggeration / onSearch / showDetail
   ├─ tilesUserOn 与 view.exagg 分离
   ├─ parseCoordQuery() → flyTo
   └─ climateAt(lon,lat) → 注入流域详情气候带
   │
arcgisData.ts ── fetchBasinsInView(): 同时产出 basin + subbasin
   ├─ MAJORBASIN 分组 → 大流域（保留现有 835,956 km² 逻辑）
   ├─ WaterProvince 分组 → 子流域（含 COUNTRY/REGION/watprovID）
   └─ fetchHydroBasinsInView(): 可选实验双轨（HYBAS_ID）
   │
basinFacts.ts (新增) ── 精选流量/课本描述/子区译名
```

### 3.2 Key interfaces

```ts
// config2.ts — 统一颜色与图层
export type Cat = ... | 'subbasin' | 'swamp'
export const CAT_COLOR: Record<Cat, string>
export const AREA_CATS: Cat[] = ['gulf','bay','ocean','lake','basin','subbasin','climate','biome','swamp']
export const ZONE_COLOR: Record<string, string>   // Köppen 字母码 → 颜色
export const BIOME_COLOR: Record<string, string>

// features3.ts
function colorForRec(rec: Rec): THREE.Color
function buildAreaBatch(recs: Rec[], cat: Cat): void  // 顶点色 + vertexColors:true
setSelected(rec: Rec | null): void                    // 整片多边形高亮

// arcgisData.ts
type BasinGroup = 'major' | 'sub'
function fetchBasinsInView(w,s,e,n): Promise<Rec[]>   // 同时产出 basin + subbasin
function fetchHydroBasinsInView(w,s,e,n): Promise<Rec[]> // 实验，失败返回 []

// main8.ts
function parseCoordQuery(q: string): {lat:number, lon:number} | null
function climateAt(lon:number, lat:number): string    // 由 climate Rec 反查
function audit(): Record<string, number>              // 各图层要素数/可见数
```

### 3.3 Data model changes
- `Rec.facts` 扩展：`流域面积 / 占父流域 / 子流域排名 / 国家地区 / 气候带 / 年径流量(精选)`。
- 新增 `Rec.parent?`（子流域 → 大流域 id）、`Rec.zone`（气候/植被类型）、`Rec.temp`（洋流冷暖）。
- `public/data/base/` 新增 5 个 JSON，全部带中文名 + facts + desc；元素数量上限：气候 9、植被 4、洋流 12、峡湾 10、沼泽 10。
- 颜色分配：`basin` 名称哈希 → HSL 金角分布；`subbasin` 在父流域色相 ±25° 内按序展开；`climate/biome` 固定调色板，保证相邻类型不撞色。

### 3.4 Error handling
- HydroSHEDS 查询失败/返回 0 → 记日志并降级到 WaterProvince，不影响主流程。
- 流域服务 500 条上限 → 视野过大时提示「缩小视野以加载更多流域」，保留已加载要素。
- 专题 JSON 缺失 → `loadAll()` 逐文件 try/catch，缺失图层显示空但不崩溃。
- 详情异步请求带 `data-rid` 守卫，避免切换选中后旧响应覆盖。

## 4. File-level change list

| File | Action | Description |
|------|--------|-------------|
| `src/v2/config2.ts` | modify | 统一颜色、图层、AREA_CATS、ZONE_COLOR/BIOME_COLOR，新增 subbasin/swamp |
| `src/v2/config.ts` | modify | 改为 `export * from './config2'` |
| `src/v2/i18n2.ts` | modify | 13 语言新增 subbasin/swamp/流量/气候带等词条 |
| `src/v2/data4.ts` | modify | FILES 增加 5 个 JSON；curated 接受新 cat；zone/temp/parent 透传 |
| `src/v2/features3.ts` | modify | 顶点色批次、分类线色、整片高亮 mesh、audit 计数 |
| `src/v2/arcgisData.ts` | modify | 子流域分组、字段补全、HydroSHEDS 实验查询 |
| `src/v2/basinFacts.ts` | create | 精选流量/描述/译名，面积象限计算 |
| `src/v2/main8.ts` | modify | 开关隔离、坐标搜索、气候注入详情、audit 出口 |
| `src/v2/ui3.ts` | modify | 新复选框词条、影像按钮状态同步 |
| `scripts/generate-thematic.mjs` | modify | 生成 5 个 JSON（含峡湾/沼泽示例） |
| `public/data/base/*.json` | create | climate/biomes/currents/fjords/swamps |
| `src/v2/*.test.ts` | create/modify | 纯函数单测与数据完整性测试 |
| `docs/plans/teaching-atlas-v2.md` | modify | 追加本轮迭代记录 |

## 5. Test plan
- Unit: 颜色不撞色、WaterProvince 分组、坐标解析（含 N/E 与负经纬度）、专题数据非空、图层默认/独立开关、zone → 中文名。
- Integration: 打开中国视野 → 开启流域 → 大流域 + 子流域数量 > 0；点击长江流域 → 高亮 mesh 出现且详情含 180 万 km² 与精选流量；开启气候 → 可见气候色块；开启洋流/峡湾/沼泽 → 线段/点出现。
- Manual: 17 个勾选项逐个勾选/取消、两两组合；地形夸张 0→8→0 与影像按钮互不干扰；搜索 `39.9,116.4` 飞到北京；全图平移检查各洲流域/气候色块。
- Validation: `tsc --noEmit`、`vitest run`、`vite build` 全绿；浏览器 `tickOnce()` 帧时 p50 < 20ms。

## 6. Rollout & rollback
- 单项提交顺序：config 合并 → 数据生成 → 渲染分色 → 子流域 → 高亮详情 → 开关/搜索 → 测试。
- 回滚：保留当前 `dist/` 与本文档；如分色性能不达标，可关闭 `useVertexColor` 开关退回类色，不影响其他功能。

## 7. Risks & open questions
- 顶点色使面批次缓冲增大 ~3 倍，需实测帧时；必要时按视野只给可见要素着色。
- 子流域数量可能很多（中国视野数百个），需限制同时渲染数量和标签 LOD。
- HydroSHEDS 服务当前按视野查询返回 0，属实验双轨，不作为验收条件。
- 流量数值为课本精选，需在详情中标注来源性质，避免误导为在线实测。
