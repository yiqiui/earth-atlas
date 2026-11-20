# 地表志 · 全球自然地貌图谱

对标谷歌地球的**自然地貌**三维可视化：Three.js 地球 + 真实卫星影像 + DEM 地形晕渲 + 真实水系烘焙，不展示人类建筑。

## 当前版本（v2，入口 `index2.html`）

打开 `http://127.0.0.1:5173/index2.html`。

- **两种地表可切换**：⛰ 地形浮雕（卫星影像 + DEM 山体阴影）/ 🛰 卫星影像。
- **4K 高清纹理**：7680×3840 地表纹理，放大更清晰；各向异性过滤 16×。
- **真实水系**：Natural Earth 10m 河流/湖泊直接烘焙进地表纹理，不是悬浮线条。
- **真实山体**：山脉靠卫星影像 + DEM 晕渲表现，没有假的山脊条带。
- **只展示自然风貌**：山峰、山脉、河流、湖泊、海洋、陆地、岛屿、海湾、海峡、海角等；水库/大坝等人工要素已过滤；气候/草原/洋流/峡湾等专题图层可开关（默认关闭，避免乱标）。
- **360° 自由旋转** + 滚轮缩放 + 双指缩放，拖动不回弹。
- **标签按缩放渐进显示**，每类限额、碰撞剔除；只显示当前缩放级别应有的大尺度要素。
- **13 种语言**：简中/繁中/英/日/韩/法/俄/德/西/葡/拉丁/阿拉伯/意。

## 运行

```bash
npm install
npm run dev
# 打开 http://127.0.0.1:5173/index2.html
```

构建与测试：

```bash
npm run build
npm test
```

## 数据更新

```bash
npm run data:extract   # 从附件抽取纹理与精选要素
npm run data:fetch     # 重新拉取 Natural Earth 数据并拼接全球 DEM
npm run data:thematic  # 生成教学专题数据（洋流/气候/草原）
```

数据来源：

- 卫星纹理：附件《地球地貌三维图谱.html》（NASA Blue Marble 8K）
- 矢量底图：[Natural Earth](https://www.naturalearthdata.com/)（公有领域）
- 高程：[Terrarium tiles](https://registry.opendata.aws/terrain-tiles/)（AWS 开放数据）

## 目录结构

```
index2.html           v2 入口（当前主用）
src/v2/               v2 实现（config2/i18n2/data4/bake6/globe6/features3/labels3/ui3/main8）
public/textures/      地球纹理（day/topo/normal/clouds）
public/data/base/     静态底图 GeoJSON + dem.png
scripts/              数据抽取与生成脚本
docs/plans/           设计与验证记录
```
