# 全球三维地貌图谱优化设计

> Status: Done
> Created: 2026-11-18
> Verified: 2026-11-18

## 验证记录

- `npm run build`：通过（tsc + vite build）
- `npm test`：10/10 通过（geo 4、dem 3、model 3）
- 浏览器实测（Vite dev server + Chromium）：无控制台错误，加载 5,658 个要素、249 个标签，地球/地形/河流/海湾/岛屿/图层面板均正常渲染。
- 最后一项数据清洗（中文名优先、跳过无名要素）已写入 `src/data/model.ts`；由于本机 Vite 对跨文件系统编辑的热更新监听失效，需重启 `npm run dev` 后在浏览器中生效。

## 1. Background & Goal

附件 `地球地貌三维图谱.html` 是一个单文件 Three.js 地球仪：内联 Three.js 与 5 张 base64 纹理（day/topo/water/clouds/normal），静态 `DATA` 共 361 条（peak 60 / river 60 / lake 55 / land 88 / range 49 / ocean 33 / trail 16）。

现存问题：

- 山脉只画一条单色线，没有随高程/坡度变化的地形差异；
- 河流水系严重不完整，且没有按等级/宽度区分；
- 缺少海湾、河湾、海峡、岛屿、海角等类别；
- 数据全部静态内联，无法更新，也没有在线增量能力。

目标：在 `D:\workspace\code\ws\earth-atlas` 新建 Vite + TypeScript 工程，以附件为视觉基线，产出**完整全球地貌图**：静态底图覆盖全球、在线增量补充现势要素，山脉按 DEM 呈现地形差异，河流/海湾/岛屿等类别完整且可分层控制。

成功标准：

- 全球范围内可检索、可定位到山脉/河流/湖泊/海洋/陆地/岛屿/海湾/河湾；
- 山脉有基于高程的起伏与分层设色，而不是单色直线；
- 在线数据失败时页面仍可用，并明确显示数据来源与更新时间；
- 构建通过，核心数据逻辑有单元测试。

## 2. Scope

### In Scope

- 从附件抽取纹理资源，迁移视觉与交互基线（旋转、缩放、飞行定位、标签、详情面板、搜索、图层开关）。
- 用 Natural Earth 公开数据生成全球静态底图（河流、湖泊、海洋、陆地、岛屿、海湾/海域、山峰/山脉）。
- 新增类别：`island`、`bay`、`gulf`、`strait`、`cape`、`plain`、`desert`、`plateau`（后三者归入 `land` 的细分标签）。
- 山脉地形差异：DEM 采样 + 高程分层设色 + 沿路径的山脊带状网格（宽度/颜色随高程变化）。
- 河流完整性与可视化：分级线宽、流向、按视口密度裁剪。
- 在线增量：Overpass（OSM）+ Wikidata 按视口拉取要素，DEM 高精度瓦片按需加载；磁盘/内存缓存；失败回退静态数据。
- UI：图层开关扩展、在线状态/数据来源标识、手动刷新、离线降级提示。

### Out of Scope

- 真实 3D 地形网格的全球高精度重建（受限于瓦片分辨率与性能，只做球面位移 + 山脊带）；
- 商业 API key、账号体系、用户上传数据；
- 海底地形细节（保留海洋色带与海沟标注）；
- 原附件中步道（trail）以外的旅游路线推荐；
- 移动端原生 App（仅响应式 Web）。

## 3. Design

### 3.1 Architecture / Data flow

```
┌─────────────────────────── Browser ───────────────────────────┐
│  UI (vanilla TS)                                              │
│   search / layers / detail / status                           │
│            │ events                        ▲ state            │
│            ▼                               │                  │
│  AppController ──────── FeatureStore ───────┘                  │
│       │                     ▲      ▲                          │
│       │ viewport bbox       │      │ merge/dedupe             │
│       ▼                     │      │                          │
│  LiveService ── Overpass / Wikidata ──▶ cache (Memory+IndexedDB)│
│       │                                                       │
│  DemService ── Mapzen/AWS Terrarium tiles ──▶ LRU + IndexedDB  │
│       │                                                       │
│       ▼                                                       │
│  Renderer (Three.js): globe + terrain shader + feature layers  │
└───────────────────────────────────────────────────────────────┘
               │ build time
     scripts/fetch-natural-earth.mjs → public/data/base/*.json
     scripts/extract-textures.mjs    → public/textures/*
```

数据流：

1. 启动加载静态底图 JSON（全球完整）→ 归一化成统一 `FeatureRecord` → 渲染；
2. 相机停止移动后按当前 bbox 触发在线增量请求（防抖 400 ms，旧请求 abort）；
3. 在线结果与静态数据按 `id`/坐标去重合并，写入 store 与 IndexedDB；
4. DEM 首次用静态全球高度图，放大到 z≥5 时按需请求高精度瓦片并缓存；
5. 在线失败只记录状态，不阻断渲染。

### 3.2 Key interfaces / signatures

```ts
type Category =
  | 'peak' | 'range' | 'river' | 'lake' | 'ocean' | 'land' | 'island'
  | 'bay' | 'gulf' | 'strait' | 'cape' | 'trail';

interface FeatureRecord {
  id: string;                    // 稳定键：source + 原始 id
  name: string;
  nameEn?: string;
  cat: Category;
  lat: number;
  lon: number;
  elevationM?: number;           // 山峰/山脉
  lengthKm?: number;             // 河流/山脉
  order?: number;                // 河流等级，决定线宽
  path?: [number, number][];     // [lon, lat]
  geometry?: GeoJSON.Geometry;   // 陆地/岛屿/湖泊/海洋/海湾多边形
  bbox?: [number, number, number, number];
  source: 'naturalearth' | 'wikidata' | 'overpass' | 'curated';
  updatedAt: string;
  facts?: [string, string][];
  desc?: string;
}

// 数据层
loadStaticBase(): Promise<FeatureRecord[]>
queryLive(bbox: BBox, signal: AbortSignal): Promise<FeatureRecord[]>
mergeFeatures(base: FeatureRecord[], live: FeatureRecord[]): FeatureRecord[]

// DEM 层
decodeTerrariumTile(png: ArrayBuffer): Float32Array
sampleElevation(lat: number, lon: number): number  // 米，失败返回 0
buildRangeRibbon(path: LonLat[], dem: DemSampler): THREE.BufferGeometry
```

坐标系沿用附件的 `llToVec`（Y 轴为极轴），所有 GeoJSON 在入库时转成 `[lat, lon]` 内部结构，避免重复换算。

### 3.3 Data model changes

无数据库迁移。新增静态资源：

| 路径 | 内容 | 来源 |
| --- | --- | --- |
| `public/textures/{day,topo,water,clouds,normal}.*` | 从附件 base64 抽出 | 附件 |
| `public/data/base/rivers.json` | 全球河流线 | Natural Earth `ne_50m_rivers_lake_centerlines` |
| `public/data/base/lakes.json` | 湖泊面 | `ne_50m_lakes` |
| `public/data/base/oceans.json` | 海洋面 | `ne_50m_ocean` |
| `public/data/base/land.json` | 陆地/岛屿面 | `ne_50m_land` + `ne_50m_minor_islands` |
| `public/data/base/marine.json` | 海湾/海峡/海域 | `ne_50m_geography_marine_polys` |
| `public/data/base/places.json` | 山峰/山脉/高原/沙漠等 | `ne_50m_geography_regions_elevation_points` + 附件精选 |
| `public/data/base/dem.png` | 全球高程图（z≈4 拼接地形瓦片） | AWS Terrarium（构建时生成） |

Natural Earth 为公有领域数据；DEM 瓦片与 OSM/Wikidata 在 UI 的“数据来源”里标注并附链接。

### 3.4 Error handling

- 静态资源缺失：启动时显示错误横幅并停止渲染，避免空白地球；
- 在线请求超时（8 s）或非 2xx：降级为“离线模式”，按钮可重试；
- Overpass 失败：自动尝试 Wikidata；两者都失败则保留静态结果；
- DEM 瓦片失败：该区域退回全球静态高度图，不抛异常；
- 所有网络请求带 `AbortSignal`、超时、请求数上限，避免相机快速拖动时堆积。

## 4. File-level change list

| File | Action | Description |
| --- | --- | --- |
| `docs/plans/global-landform-atlas.md` | create | 本设计文档 |
| `package.json` / `tsconfig.json` / `vite.config.ts` / `index.html` | create | Vite + TS 工程骨架 |
| `scripts/extract-textures.mjs` | create | 从附件抽取 5 张纹理 |
| `scripts/fetch-natural-earth.mjs` | create | 下载并转换 Natural Earth GeoJSON、生成全球 DEM |
| `public/data/base/*.json` | create | 全球静态底图数据（提交入库，离线可用） |
| `public/textures/*` | create | 地球纹理资源 |
| `src/main.ts` / `src/style.css` | create | 入口、布局与主题（沿用附件配色） |
| `src/data/model.ts` | create | 类型定义与归一化 |
| `src/data/static.ts` | create | 静态底图加载 |
| `src/data/live.ts` | create | Overpass/Wikidata 在线增量、缓存、降级 |
| `src/core/geo.ts` | create | 坐标、bbox、投影、去重工具 |
| `src/core/dem.ts` | create | Terrarium 解码、采样、瓦片缓存 |
| `src/render/globe.ts` | create | 场景、地球、地形位移与设色 |
| `src/render/features.ts` | create | 点/线/面/山脊带渲染与分层 |
| `src/render/labels.ts` | create | 标签优先级、遮挡与碰撞控制 |
| `src/ui/panels.ts` | create | 图层、详情、搜索、状态栏 |
| `src/**/*.test.ts` | create | 数据归一化、bbox 查询、DEM 解码单测 |
| `README.md` | create | 运行、数据来源、更新数据脚本说明 |

## 5. Test plan

- Unit（Vitest）：`geo` 的 bbox/坐标换算；`model` 的 GeoJSON→FeatureRecord 归一化与去重；`dem` 的 Terrarium 解码与高程映射；`live` 的查询构造与回退逻辑。
- Integration：`npm run build` 通过；启动 dev server 后静态底图能完整加载，无 404。
- Manual（浏览器）：全球视角能看到陆地/海洋/主要山脉/河流/岛屿；放大到某区域能触发在线增量并在状态栏显示；断网时退回静态数据且页面可用；图层开关、搜索、点击详情均正常。

## 6. Rollout & rollback

- 静态数据随仓库提交，默认可用；在线增量默认开启但可一键关闭（localStorage 开关）；
- 回滚：关闭在线层开关即可恢复纯静态行为；整体回滚删除 `earth-atlas` 目录即可，不影响 ws 下其它项目。

## 7. Risks & open questions

- Natural Earth `ne_50m` 只能保证中尺度完整度；追求“每条河湾都标出”需要 `ne_10m`（数据量大 5–10 倍），可在 `scripts/fetch-natural-earth.mjs` 加 `SCALE=10m` 选项按需生成。
- Overpass 对全球大 bbox 查询慢，因此只在高缩放级别、小 bbox 下触发；全球概览完全依赖静态底图。
- 在线要素中文名依赖 OSM `name:zh` 与 Wikidata 中文标签，缺失时显示英文名并标记来源。
- DEM 瓦片服务的 CORS 与配额需要在实现时用真实请求验证，必要时改由构建脚本预先生成全球高程图。
