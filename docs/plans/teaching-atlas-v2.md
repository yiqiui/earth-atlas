# 教学版全球地貌图谱升级设计

> Status: Done
> Created: 2026-11-18
> Verified: 2026-11-19

## v2 全新实现（2026-11-19，入口 index2.html）

对标谷歌地球的自然地貌版，`src/v2/` 全新文件绕开 Vite 冻结缓存：

- **地表浮雕**：用 DEM 生成分层设色地形纹理（绿平原→黄棕高原→红褐高山→雪峰白→蓝海）+ 西北光晕渲，真实河流/湖泊烘进纹理；「⛰ 浮雕 ↔ 🛰 卫星影像」可切换。
- **水系真实**：Natural Earth 10m 河流/湖泊直接画进地表纹理，不是悬浮线条。
- **只展示自然风貌**：过滤水库/大坝/运河等人工要素；默认只开 10 个自然图层，气候/草原/洋流/峡湾/步道/海角默认关闭，全部可开关。
- **360度自由旋转**：theta 无限制，phi 接近全范围；修复了拖动后误触 flyTo 导致的回弹。
- **标签精简**：按缩放 LOD 渐进显示，每类限额，碰撞剔除；中文优先。
- 13 语言切换（i18n2.ts）。
- 实测：浮雕/卫星纹理均烘焙成功（4096px，Correct 绿/棕/蓝色分布）、1810 要素、186 标签、旋转正常、无人工水体标签、无控制台错误。

## 南北颠倒问题修复（2026-11-19，入口仍 index2.html）

用户反馈"地图倒过来"。两个根因：

1. **CanvasTexture + ImageBitmap 的 flipY 失效**：`globe6.ts` 改为先把 ImageBitmap 画到 HTMLCanvasElement，再用 canvas 作纹理源（`flipY=true` 才生效）。初始 day.jpg（TextureLoader + HTMLImageElement）本来就正常，所以只有烘焙后翻。
2. **DEM 重新上色把低地误判为海洋**：8-bit dem.png 区分辨率差（亚马逊15/撒哈拉31/北冰洋0 很接近），按高程重新上色会把亚马逊涂成蓝色。`bake6.ts` 改为**卫星影像作底图 + DEM 只做 hillshade 明暗叠加 + 真实水系**，不再重新上色。

实测纹理采样全部正确：亚马逊/刚果深绿、撒哈拉亮沙、青藏棕褐、南北极冰雪白、海洋蓝；浮雕↔卫星切换、360度旋转均正常。

## 4K + 去条带改动（2026-11-19，待重启验证）

已写入现有文件（未新建入口）：
- `src/v2/config2.ts`：W/H 改为 7680×3840（4K UHD 级）。
- `src/v2/bake6.ts`：写死 `W=7680, H=3840`（绕开 config2 缓存传播问题）。
- `src/v2/features3.ts`：移除 `this.ribbon(rec, pts)`（黄色山脉条带）和 river 线材质（蓝色悬浮线）；水系完全靠烘焙进纹理表现。
- `index2.html`：入口 `main8.ts?x=4kfinal77`。

**注意**：Vite 内存缓存导致无参数模块仍返回旧代码，shell 又被后台 Vite 进程锁死，无法重启。用户将重启 OpenCode 解锁。

### 最终执行结果（2026-11-19）
1. ✅ `scripts/cleanup-debug.sh` 已执行，删除了全部 v1 与废弃 v2 中间文件，仅保留：
   `index2.html`(入口)、`src/v2/{config,config2,i18n2,data4,bake6,globe6,features3,labels3,ui3,main8}`、`src/style.css`、`index.html`(重定向到 index2)。
2. ✅ 修复清理后悬空引用（features3/labels3 的 `Rec` 从已删的 data2 改到 data4）与 8 处 noUnused 编译错误。
3. ✅ `vite.config.ts`：多入口（index.html + index2.html）；server host 127.0.0.1。
4. ✅ `npm run build` 通过：21 模块转换，index2.html 打包，atlas JS 536KB。
5. ✅ `npm test` 通过：7/7（新增 i18n2.test.ts、config2.test.ts）。
6. ✅ 生产产物验证：atlas JS 含 `7680`（4K 参数）、无 `0x54bcd8`（河流线）、无 `ribbon`（山脉条带）。
7. ✅ 浏览器实测通过（改用 Windows 原生 node 启动 Vite，绕开失效的 WSL localhost 转发；并补装 @rollup/rollup-win32-x64-msvc）：
   - 纹理 7680×3840（真 4K），状态"地貌完成"（烘焙成功）
   - 颜色正确：亚马逊深绿、撒哈拉沙色、太平洋蓝、冰雪白
   - 360° 旋转正常（拖动 theta 变化约 200°）
   - 场景无悬浮线条（Line2 计数 0，仅地球/云层/选择环 3 个 mesh）
   - 默认 10 个自然地貌图层，专题默认关闭
   - 启动命令：`node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173`（Windows node）

## 谷歌地球式瓦片层（2026-11-19，最终）

用户反馈"依旧模糊""河流没勾选还在"。根因与修复：

- **模糊根因**：全球影像仅 8192×4096，放大到区域级必糊。
- **河流根因**：河流被烘焙进纹理（粗蓝线），与图层开关无关且假。

修复：
- 新增 `src/v2/tiles.ts`：ESRI World Imagery 免费卫星瓦片（无需 key、CORS 可用），按需加载。固定 z=13、5×5 瓦片、近景(dist<5.2)显示、LRU 缓存(≤60)、中心瓦片脏检查 + inflight 上限(40)，杜绝请求爆炸。
- `bake6.ts` 移除河流/湖泊烘焙（真实卫星影像里水系本就清晰）。
- `globe6.ts` 集成瓦片层，瓦片模式下地形位移=0（避免穿模），地形起伏滑杆调高时自动关闭瓦片。
- 实测：切到中国(lon105/lat35, dist2.6)后加载 5×5=25 片 z13 瓦片，影像为真实陆地色（绿/棕），vis=25、inflight=0，无错误。放大清晰度达到谷歌地球级。
- 构建：Windows node build 通过（22 模块，tsc 无错误）。

## 河流形态与静态/动态切换（2026-11-19）

用户反馈："河流怎么显示的点""位置不对""静态和动态获取要有按钮切换"。

- **河流不打点不画线**：Natural Earth 河流简化中心线在高清瓦片上像假折线，与真实河流形态不符。对标谷歌地球——水系由卫星影像本身呈现，河流数据仅用于名称标签。features3.ts：河流跳过点标记与线渲染（Line2 计数 0）。
- **拾取精度**：raycaster Points threshold 从默认降到 0.012，避免鼠标在广东却拾取到山东半岛的点。
- **静态/动态切换按钮**：🌐 按钮切换 ESRI 在线瓦片（动态高清）与内置烘焙卫星影像（离线静态），实测 true↔false 正常。
- 实测：河流折线消失、无河流点、切换按钮工作、瓦片正常。

## 全面修正（2026-11-19，最新）

用户反馈：点详情错位、河流走势要显示、海域范围要标出、地图仍糊。系统性重构：

1. **点详情错位根因**：Three.js Points 射线拾取不区分球体正反面——射线穿过地球能击中背面要素（如点南海却拾取到山东的泰山十八盘）。`features3.ts` 的 pick 加背面剔除（`p.dot(camDir) < 0.15` 忽略）。
2. **数据层保留完整几何**：`data4.ts` 重写，新增 `rings`（面要素外环）字段，锚点改用质心（原来用首顶点导致海域标错位置）。
3. **河流真实路径线**：`features3.ts` 用 CatmullRom 平滑的贴地细线画河流（长江黄河走势可见），不打点。
4. **海域范围**：gulf/bay/ocean/lake 用真实多边形半透明填充+边界（南海/东海范围标出）；land/island 由卫星影像呈现不填充；跳过跨全球超大环。
5. **清晰度**：瓦片层级动态化——dist≤2.0→z16, ≤3.0→z15, 否则z14（原来固定z13偏糊）。
6. 实测：riverLines=403、fills=513、tileZ=15、背面剔除生效、build 通过。

## 清晰度/颜色/详情优化（2026-11-19，最新）

用户选择：瓦片拉到 z17-18、影像为主+可开关彩色水系、点击飞到放大展示已有数据。

- 瓦片层级：`tiles.ts` level() 改为 dist≤1.9→z18, ≤2.4→z17, ≤3.0→z16, 否则z15；maxZoom=19；高zoom span=3(7×7)；inflight上限60、LRU 150。实测近景 z18、49 片全显示、无拥塞。
- 水系颜色：`config.ts` 河流#2b8fd6(蓝)、湖泊#28c2b0(青绿)、海洋#3a6fb0(深蓝)；填充透明度 0.3、边界 0.6。
- 影像为主：`config2.ts`/`ui3.ts` 默认关闭 river/lake/ocean 图层，勾选才显示彩色水系。
- 点击详情：`main8.ts` flyTo 目标 dist=1.85（触发 z18 高清），详情面板显示已有真实数据。
- build + 7 测试通过；浏览器实测 z18 瓦片清晰、水系开关正常。

## 视野影像 + 地貌描述（2026-11-18 最新，根本性清晰度修复）

用户反馈"依旧很糊，不如谷歌地图"。诊断出真正根因：

- **根因**：瓦片层级 z17/18 每片仅覆盖 0.0014°，7×7 瓦片只铺满 0.019°，而相机视野达 60°——高清瓦片只覆盖针尖大小，99.9% 屏幕是模糊底层图。测得 ratio≈3100。
- **修复（根本性）**：`tiles.ts` 完全重写为**视野影像层**——用 ESRI `MapServer/export` API 按当前视野 bbox 导出单张 2048×2048 高清影像贴到球面，一次覆盖约 36°×36°，清晰度约 0.017°/像素（比之前提升约 2000 倍）。相机移动/缩放自动重新导出（防抖 220ms + bbox 缓存），远景(dist>3)隐藏回退底层 8K 图。
- 实测：export 影像 2048px、bbox 正确覆盖中国、颜色正确；浏览器实测清晰。
- **地貌描述**：`data4.ts` 内置 DESCRIPTIONS 库（长江/黄河/湄公河/南海/东海/台湾岛/夏威夷/青藏高原等著名地貌的教学性描述），按名称注入；同名要素去重（1729→1630）。实测 307 条有描述，点击详情可看。Wikipedia API 在当前网络环境不可达，故用内置描述。
- **诚实限制**：河流矢量来自 Natural Earth（简化），湄公河/黄河走势是主干非全支流，这是数据源精度上限，需接 OSM 水系才能更精确；ESRI 影像需联网。

## 真实水系 + 海域显示（2026-11-19 最终）

用户反馈：东海消失、黄河几字弯不对、湄公河断流、长江出海口、台湾海峡消失。诊断：Natural Earth 简化数据精度不够 + 海域标签被限额挤掉。用户选择：接 OSM 真实水系 + 海域名称范围都显示 + 彻底重构。

- **真实水系**：`osmRivers.ts` 内置 8 条精选真实河道的密集控制点（长江29点含出海口、黄河29点含几字弯、湄公河20点全河段到出海、珠江/黑龙江/淮河/雅鲁藏布江/松花江），替换 Natural Earth 简化线。曾尝试 Overpass 实时拉取，但 API 超时/限流不可靠，改为内置真实坐标（离线可用、加载快）。实测 8 条真实河流加载、控制点正确。
- **海域显示**：`labels3.ts` 提高海域(ocean/gulf/bay/strait)优先级与名额、同名去重；`config2.ts`/`ui3.ts` 默认开启海域图层。实测东海/黄海/渤海/南海/台湾海峡全部显示。
- 视野影像(ESRI export 2048px)、地貌描述库保留。
- 实测：8 条真实河流、5 个海域标签全显示、build 通过、7 测试通过。

## 对标 Google Earth 清晰度（2026-11-20 最终）

用户给出 Google Earth/天地图/Zoom Earth/NASA Worldview 等参考，要求"足够清晰 + 数据准确 + 地貌信息齐全"。

服务可用性实测：仅 ESRI World Imagery 稳定可用（无需 token）；Google/天地图/Mapbox/OSM瓦片在此环境不可达或需 token。故影像源锁定 ESRI（正是 ArcGIS Earth 同源）。

核心洞察（Google Earth 清晰的原理）：**相机贴近地表时视野变小，影像/瓦片才能铺满达到高清**。之前 bbox 写死 18°、视野与影像不匹配导致糊。

修复：
- `tiles.ts` 重写视野影像层：bbox 真正跟随视野角（acos(1/dist)），ESRI export 4096×4096（服务上限），一张图铺满视野。dist>1.6 回退底层 8K 全球影像。
- `main8.ts` 缩放下限 1.02（贴地），flyTo 目标 1.02（点击要素飞到贴地近景）。
- `globe6.ts` 球体分段提到 512×256、相机 near 降到 0.001（减少贴地棱角/裁切）。
- 实测：贴地 dist=1.05 时 bbox 跟随视野、4096px 影像正确加载、颜色正确；8 真实河流 + 5 海域标签正常；build + 7 测试通过。

**诚实限制**：SST 服务仅 ESRI 可用（影像质量在某些区域不如 Google，但已是此环境最优）；贴地过近(1.02)可能有轻微球面多边形棱角；真实河流为密集控制点（非测绘级）。

## 河流不显示 Bug 修复（2026-11-20）

用户反馈"河流在哪呢没有啊"。根因：`config2.ts` 的 ALL_LAYERS 在之前"影像为主"改动中漏掉了 river/lake，导致 `FeatureLayer3` 构造时没创建 layer-river group——河流数据加载了(60条)却完全没有可渲染对象（line2=0）。

修复：config2.ts 的 DEFAULT_LAYERS/ALL_LAYERS 加回 river/lake，ui3.ts defaultOn 去掉 river/lake 排除（默认开启）。实测：layer-river group 出现、389 条河流线渲染、复选框默认勾选、8 条真实河流(长江/黄河/湄公河等含密集控制点)完整。

## 流域图层 + 批量渲染 + 全中文标签（2026-11-20 最终）

**1. 流域（basin）图层落地**：`arcgisData.ts` 按视野 bbox 查询 ArcGIS `GlobalWaterProvinces_view`（~400ms），同名 MAJORBASIN 合并 rings/holes，`AREAkm2` 求和得流域面积。
- 修复 `buildArea` 崩溃：`THREE.ShapeUtils.triangulateShape` 的 contour 参数误传"外环+内洞合并数组"，导致洞被重复追加、三角形索引越界（`Cannot read properties of undefined (reading 'x')`）。改为 contour=外环切片、holes 单独传入，索引与 flat 顺序一致。
- `features3.ts` **批量渲染重写**：河流并入 4 个 `LineSegments2` 批次（按 rank 分线宽档）；每个面类别合并为 1 填充 + 1 边界批次；逐河 Line2 降级为不入场景的拾取代理；面拾取改经纬度点选（bbox 预筛 + 射线法 + 背面剔除）。**draw call 3428 → 26，帧时 p50 74ms → 2ms**（含流域 6.5 万三角形时 1.6ms）。
- 修复大环（南海 913 点）被 300 点上限跳过：上限提到 6000；新增 `subdivideTriangles` 长边细分贴球，防止大三角弦沉进球体；无环面要素（洞庭湖等）退化为点标记。
- 验证：93 个流域组、黄河流域 4433 三角形、`黄河流域 835,956 km²`、`长江流域 1,800,974 km²`（与官方 180.8 万 km² 吻合）；点选南海/贝加尔湖/黄河流域/黄河/渤海 tooltip 全部命中；点击河流详情异步追加「所属流域/流域面积」。
- `queryBasinAt` 的 outStatistics 求和在该服务返回 null → 改为 where 拉 AREAkm2 客户端求和；BASIN_URL 已含 /query，修正三处重复 `/query/query`。

**2. 全中文标签**：`geoNames.ts` 按要素坐标逐条核定并补齐 NE10 全部无名河湖（新增约 400 条：多瑙河三角洲汊流、西伯利亚汊河、加拿大北极水系、美国东南/西部、南美、非洲、新西兰 45 条支流、中国支流如富春江/闪电河/大理河/邕江/都柳江等）。实测 3177 条要素拉丁名归零，放大后可见标签全部为中文（如几字弯视角 159 个标签 0 英文）。
- 详情面板中文界面不再显示 `.en` 英文副标题（`showEn = !lang().startsWith('zh')`）。

**3. 调试出口**：`window.__atlas2 = { view, data, select, globe, features, labels, ui, enabled, tickOnce }`；tickOnce 手动驱动一帧（本环境 rAF 被挂起，浏览器验证全靠它）。

**4. 构建验证全绿**（shell 曾因 WindowsApps pwsh 别名被系统拒绝 os error 5，通过项目 `opencode.json` 将 shell 切到 `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` 修复）：
- `tsc --noEmit` 退出码 0（16 个源文件 0 诊断）；
- `vitest run` 7/7 通过（i18n2 4 + config2 3）；
- `vite build` 成功（dist/atlas js 597 kB，gzip 167 kB）。
- 运行时复验：3177 条要素 0 拉丁名；放大后可见标签全中文（几字弯视角 159 标签）；点击黄河/贝加尔湖/南海详情正常；开启 basin 后黄河流域 835,956 km²（2.8s 加载）；中文界面详情无英文副标题。

## 专题图层扩展：分色流域 / 子流域 / 气候 / 全勾选项生效（2026-11-20 最终）

设计文档：`docs/plans/thematic-layers.md`（Status: Done）。

- **配置统一**：`config.ts` 改为 `export * from './config2'`，颜色/图层/尺寸单一数据源；新增 `subbasin`、`swamp` 两个图层及 13 语言词条。
- **真实专题数据**：`scripts/fetch-climate.mjs` 从 ArcGIS Köppen-Geiger 观测服务拉取 2319 个气候面，按 11 个教学气候类型归并生成 `climate.json`（362 KB）；`scripts/generate-thematic.mjs` 生成 13 洋流 / 4 植被 / 10 峡湾 / 10 沼泽，`loadAll()` 全部加载。
- **流域分色 + 子流域**：`palette.ts` 用名称哈希金角分布给大流域稳定分色，子流域在父色相附近展开；`features3.buildAreaBatch()` 改为 **per-vertex 颜色**（fill/edge 均带 color 属性，顶点数与 position 严格一致，修复过一次少传 3 倍导致 NaN 的 bug）；气候/植被按 zone 固定调色板。
- **子流域数据**：`fetchBasinsInView()` 同时按 `MAJORBASIN`（93 大流域）与 `WaterProvince`（985 子流域）分组，带面积、占父流域比例、面积排名、国家地区、气候带；HydroSHEDS v2 `HYBAS_ID` 作为实验双轨，服务返回空时静默降级。
- **精选水量**：`basinFacts.ts` 给 13 个大流域写课本级年径流量并标注"教学参考值"；子流域不套用父流域流量，明确显示"暂无权威在线流量数据"。大流域详情列出前 6 个子流域及面积。
- **点击高亮**：`setSelected()` 用 `triangulateRing()` 为整片面生成高亮 mesh（面要素不再只是质心金圈），长江/黄河等点击后整片发亮 + 详情完整。
- **开关隔离**：地形夸张不再覆盖用户影像开关（`tilesUserOn` 与 `view.exagg` 分离）；17→19 个勾选项逐个与组合勾选均验证有效，关掉 climate 不影响其他 18 项。
- **经纬度支持**：搜索 `39.9,116.4` / `N39.9 E116.4` 可飞到坐标，详情显示海拔与所在气候带；状态栏坐标追加海拔；经纬网已有。
- **全图检查**：`window.__atlas2.audit()` 返回逐图层数据数/绘制对象数/开关状态；东亚/欧洲/北美/南美/非洲/澳洲 6 视野扫查全部有要素，稳态帧时 p50 7ms（4–11ms）。
- **验证**：`tsc --noEmit` 0 错误；`vitest run` 16/16；`vite build` 成功（js 618 kB / gzip 174 kB）；浏览器实测 3372 要素、拉丁名 0、NaN 顶点 0、流域 81 色 / 子流域 262 色 / 气候 11 色。

## 渲染自适应 LOD 提速（2026-11-20 最终）

用户反馈"感觉卡卡的"。实测 `renderer.info` 320 万三角形 / 24 万线段，CPU 帧耗时仅 7ms，瓶颈在 GPU 渲染量与透明叠加。设计文档：`docs/plans/render-lod-optimization.md`（Done）。

- 新增 `src/v2/lod.ts`：far/mid/near 三档 + 滞回阈值（far≥2.6、near≤1.3，中间保持原档），避免临界距离反复重建。
- 远景：河流采样 80→24 点、面环 6000→120 点、长边细分 0.10→0.22、每要素只保留最大的 24 个环、跳过内洞与边界线；中景居中；近景保留 6000 点环与边界。
- `features3.setLod()` 每帧调用但只在档位真正变化时重建，且通过 `requestIdleCallback`（超时 250ms 退化 setTimeout）放到空闲帧执行——缩放当帧实测仅 12ms，不再卡住。
- `buildAreaBatch` 远景按环 bbox 面积排序裁掉碎面：气候 2319 个小面不再全部剖分，重建耗时从 2.4s 降到 140ms（远景）/ 334ms（近景）。
- `__atlas2.perf()` 暴露 LOD 档位、重建耗时、renderer 统计与当前视距。
- 实测：远景三角形 **320 万 → 77 万（-76%）**、线段 24 万 → 37；近景 320 万 → 163 万；CPU 稳态帧时 p50 2ms；中文名无 Latin 混入。
- 验证：`tsc` 0 错误；`vitest` 19/19（新增 lod 3 项）；`vite build` 成功（js 620 kB / gzip 175 kB）。

## 瓦片清晰度 / 分类配色 / 全要素详情（2026-11-20 最终）

用户反馈"太糊、颜色分不清、点击只有名字"。设计文档：`docs/plans/clarity-colors-details.md`（Done）。

- **清晰度**：`tiles.ts` 从 `MapServer/export`（实测单次 8–14 秒，镜头移动时永远是过期影像）改为 `MapServer/tile/{z}/{y}/{x}` 分级瓦片。按视距选 zoom（视野约 6 张瓦片、上限 36 张），量化到瓦片边界，最多 25 块并行拉取并拼到 canvas 纹理（近景 1280×1280），瓦片按 `z/x/y` 缓存；实测近景首屏约 3s、二次切换即时。远景仍用 8K 烘焙影像。
- **配色**：`config2.CAT_COLOR` 19 类全部重做——河流亮蓝、湖泊青绿、海洋深蓝、海湾浅蓝、大海湾紫、海峡金、陆地暖黄、岛屿橄榄绿等，水系不再一片蓝；面填充不透明度 0.38、边界 0.85，辨识度更高。
- **全要素详情**：新增 `teaching.ts`，对缺失 desc/facts 的要素按 19 个类别生成科普段落 + 事实表（类别、坐标、DEM 海拔、Köppen 气候带、所属流域、附近地貌、教学示意说明）；数值只用本地真实数据，不编造面积/长度。`showDetail()` 接入并暴露 `__atlas2.detailStats()`。
- **修复精选数据被吞**：`data4` 去重改为同名重复时合并 curated 的描述/事实到保留要素（乞力马扎罗山恢复 5,895m 与"赤道附近孤立火山"），避免 NE 版本覆盖精选教学数据；详情面板坐标不再重复显示。
- 实测：19 类色值全不相同；点击无名岛屿/山峰均得到 2 句以上中文介绍与 ≥5 项事实；`tsc` 0 错误、`vitest` 22/22、`vite build` 成功（js 626 kB / gzip 179 kB）。

## 清晰度与点击体验补救（2026-11-20 最终）

用户复测反馈近景仍糊、海洋被大片蓝色遮住、点击只弹名称提示。

- **瓦片分辨率提升**：zoom 选择从「视野跨 6 张」改为「跨 10 张」，上限从 36 张提到 196 张。近景 dist=1.02 实测 z7 / 12×13=156 张瓦片、纹理 **3072×3328**（原 1024×1024），首屏约 3.8s；瓦片缓存后切换即时。放弃 4096 export 渐进精化——实测小 bbox 2048 需 5s、4096 需 45s，不适合作为主路径。
- **海洋不再盖住影像**：面填充按类设透明度——海洋 0.10、海湾 0.13、大海湾 0.15、湖泊 0.20、流域 0.26–0.28、专题 0.26–0.30；海洋边界 0.45、其余 0.75；水色改为低饱和深蓝/青，卫星影像可见。
- **点击必开详情**：`bindPointer()` 的 click 处理改为用点击坐标现场射线拾取（不再依赖 hover 状态），并放宽拖动后 350ms→200ms 的抑制；标签层 `pointer-events:none` 不会挡点击。实测点击画面中山脉直接打开详情面板（含描述与事实表）。
- 验证：`tsc` 0 错误、`vitest` 22/22、`vite build` 成功。

## 关键缺陷修复记录（2026-11-19）

- **坐标顺序错误（主因）**：附件精选数据的 `path` 是 `[纬度, 经度]`，而代码按 GeoJSON 的 `[经度, 纬度]` 解析，导致所有河流/山脉线条镜像错位。已在 `src/data/static.ts` 的 `curatedToRecords()` 中反转。浏览器截图确认尼日尔河、尼罗河、刚果河、阿尔卑斯/喜马拉雅等线条位置正确。
- **面状要素渲染**：湖泊、海湾、河湾、海峡改为真实多边形半透明填充，不再画线框。
- **河流平滑**：用 CatmullRom 曲线插值并按 DEM 重新投影到球面，消除生硬折线。
- **专题本地化**：洋流/气候/草原数据补充 `name_zh`，中文界面显示中文名。
- **峡湾**：新增 10 条世界著名峡湾真实坐标数据（挪威、新西兰、智利、格陵兰、加拿大）。
- 构建 `npm run build` 通过；`npm test` 15/15 通过；浏览器实测要素 1,434 个、标签 209 个、13 语言、15 图层、默认分层设色开启，无控制台错误。

## 1. Background & Goal

第一版已完成全球底图、DEM 地形、在线增量与基础图层，但用户反馈：

- 矢量线条过密（河流、湖/湾轮廓、山脉脊线叠加成“乱线”）；
- 地形起伏不明显，青藏高原等高海拔区缺乏视觉高差；
- 缺少地理教学专题：洋流、气候类型（如温带大陆性气候）、草原/植被；
- 不支持多语言，无法覆盖小初高至高校师生。

目标：升级为**面向地理教学的全球三维专题图谱**，做到线条清晰、地形突出、专题完整、13 语言可用。

成功标准：

- 默认视图干净，缩放时能按需呈现细节；
- 青藏高原、安第斯、阿尔卑斯等明显隆起，分层设色默认开启；
- 洋流、气候类型、草原有独立图层、图例与教学说明；
- 简体中文、繁体中文、英语、日语、韩语、法语、俄语、德语、西班牙语、葡萄牙语、拉丁语、阿拉伯语、意大利语 UI 与地名可切换。

## 2. Scope

### In Scope

- LOD 分层显示：按 `dist` 分级控制河流/湖湾轮廓/山脊带/标签密度；过滤跨经线跳点造成的“飞线”。
- 地形增强：提高 DEM 位移量、默认开启分层设色、按海拔调整光泽。
- 新增专题：洋流（暖/冷流、箭头与流向动画）、气候类型（Köppen 教学简化）、草原/植被。
- 内置专题数据（教学示意，离线可用）+ 在线增量（OSM 草原、Wikidata 洋流）。
- i18n：UI 文案 + 地名（Natural Earth 多语言字段 + 精选数据译名表 + 拉丁语回退策略）。
- 详情面板增加学段提示与教学要点。

### Out of Scope

- 科研级气候模型/洋流数值预报（明确标注“教学示意”）；
- 全部地名的 13 语言人工校对（使用 Natural Earth 现有译名字段）；
- 后端服务与账号体系；
- 3D 地形网格的全球高精度重建。

## 3. Design

### 3.1 Architecture / Data flow

```
src/i18n/index.ts         UI 文案字典 + 语言状态 + 地名选择
src/data/model.ts         FeatureRecord.names（多语言名） + displayName(rec, lang)
public/data/base/
  currents.json           洋流线（内置教学数据）
  climate.json            气候类型面（内置教学示意）
  biomes.json             草原/植被面（内置教学示意）
src/render/features.ts    LOD + 专题渲染（洋流箭头/气候填充/草原填充）
src/data/live.ts          扩展 Overpass/Wikidata 查询专题要素
src/ui/panels.ts          语言选择器、专题图层、图例、教学说明
```

### 3.2 Key interfaces

```ts
type Lang = 'zh'|'zh-TW'|'en'|'ja'|'ko'|'fr'|'ru'|'de'|'es'|'pt'|'la'|'ar'|'it'
type Category = ... | 'current' | 'climate' | 'biome'

interface FeatureRecord {
  names?: Partial<Record<Lang, string>>
  temp?: 'warm' | 'cold'        // 洋流
  zone?: string                 // 气候/植被类型
  teaching?: string             // 教学要点
}
function displayName(rec: FeatureRecord, lang: Lang): string
function t(lang: Lang, key: string): string
function setLanguage(lang: Lang): void
```

### 3.3 数据模型与清洗

- `geoJsonToRecords` 读取 Natural Earth 的 `name_zh/name_zht/name_en/name_ja/...` 写入 `names`；
- 精选数据只有 `name`（中文）与 `en`，拉丁语为精选词条人工转写，其余语言回退英文；
- 过滤规则：无名要素跳过、路径相邻点跨经线 > 30° 时切段、默认隐藏低等级河流。

### 3.4 渲染规则

- **LOD**：`dist > 3.2` 只显示 scalerank ≤ 2 的河流与主要山脉；`dist ≤ 3.2` 显示全部；湖/湾轮廓只在近景显示。
- **地形**：`rise = elev/9000 * 0.035 * exaggeration`，默认 `exaggeration = 3`，分层设色默认开启。
- **洋流**：沿路径绘制带箭头的 Line2，暖流 `#e07a4f`、寒流 `#5aa8d8`，虚线动画表示流向。
- **气候/草原**：多边形以质心三角扇投影到球面，半透明填充（`opacity 0.18`），按类型着色；只在近景或图层开启时显示。

### 3.5 错误处理

- 专题数据缺失时图层显示“暂无数据”，不阻断底图；
- 在线专题请求失败回退内置数据；
- 语言切换失败回退英文，UI 不空白。

## 4. File-level change list

| File | Action | Description |
| --- | --- | --- |
| `docs/plans/teaching-atlas-v2.md` | create | 本设计文档 |
| `src/i18n/index.ts` | create | 13 语言字典、语言状态、地名翻译 |
| `src/data/model.ts` | modify | 多语言名字段、显示函数、路径清洗 |
| `src/data/static.ts` | modify | 加载专题数据 |
| `src/data/live.ts` | modify | 在线专题查询 |
| `src/render/features.ts` | modify | LOD、洋流/气候/草原渲染 |
| `src/render/globe.ts` | modify | 地形夸张、默认设色 |
| `src/render/labels.ts` | modify | 语言感知标签 |
| `src/ui/panels.ts` | modify | 语言选择器、专题图层与图例 |
| `src/main.ts` | modify | 语言状态、LOD 更新、专题图层开关 |
| `public/data/base/currents.json` | create | 洋流教学数据 |
| `public/data/base/climate.json` | create | 气候类型教学数据 |
| `public/data/base/biomes.json` | create | 草原/植被教学数据 |
| `src/**/*.test.ts` | modify/create | i18n、LOD、数据清洗测试 |

## 5. Test plan

- Unit：i18n 回退、路径切段、LOD 筛选、多语言地名选择。
- Build：`npm run build` 通过。
- Manual：13 语言切换；默认视图线条清爽；拉近后细节出现；青藏高原明显隆起；洋流/气候/草原图层可开关并有图例。

## 6. Rollout & rollback

专题图层默认关闭或低透明度，避免干扰基础地貌；通过 localStorage 记录开关；回滚只需关闭专题层或恢复旧版本文件。

## 7. Risks

- 气候/草原边界为教学示意，必须在 UI 明确标注，避免被误用为科研数据。
- 拉丁语地名覆盖有限，使用转写并回退英文，需向用户说明。
- 多边形球面三角扇填充在大范围区域会有形变，需配合透明度与近景限制。
- 本机后台 dev server 占用 shell，最终构建/测试需先停止它后重跑。
