/**
 * 用本机 Chrome + playwright-core 为 README 生成截图。
 * 用法：先 npm run dev，再 node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright-core'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'docs', 'screenshots')
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
page.on('console', m => { if (m.type() === 'error') console.error('[browser]', m.text().slice(0, 200)) })
await page.goto('http://localhost:5173/index2.html', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForFunction(() => !!window.__atlas2?.audit, null, { timeout: 120000 })
await page.waitForTimeout(2500)

const tick = (n = 3) => page.evaluate(k => { for (let i = 0; i < k; i++) window.__atlas2.tickOnce() }, n)

// 1. 全图
await tick()
await page.screenshot({ path: path.join(out, 'global.png'), timeout: 120000, animations: 'disabled' })
console.log('global.png')

// 2. 近景（黄河几字弯）+ 流域面
await page.evaluate(() => {
  const S = window.__atlas2, D = Math.PI / 180
  S.ui.cb.onToggleCat(['basin', 'subbasin'], true)
  S.view.theta = S.view.targetTheta = 110 * D
  S.view.phi = S.view.targetPhi = (90 - 38) * D
  S.view.dist = S.view.targetDist = 1.06
})
await page.waitForTimeout(18000)
await tick(5)
await page.screenshot({ path: path.join(out, 'basins-close.png'), timeout: 120000, animations: 'disabled' })
console.log('basins-close.png')

// 3. 点击要素后的详情面板
await page.evaluate(() => {
  const S = window.__atlas2
  const rec = S.data().find(r => r.name === '长江流域') || S.data().find(r => r.name === '黄河流域')
  if (rec) S.select(rec)
})
await page.waitForTimeout(2000)
await tick(4)
await page.screenshot({ path: path.join(out, 'detail.png'), timeout: 120000, animations: 'disabled' })
console.log('detail.png')

await browser.close()
