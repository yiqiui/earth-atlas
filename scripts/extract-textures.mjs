/**
 * 从单文件附件《地球地貌三维图谱.html》抽取纹理与精选要素数据。
 * 用法：node scripts/extract-textures.mjs [附件路径]
 * 默认路径：~/Downloads/地球地貌三维图谱.html
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2] || path.join(os.homedir(), 'Downloads', '地球地貌三维图谱.html')
if (!fs.existsSync(source)) {
  console.error(`找不到附件: ${source}`)
  process.exit(1)
}

const html = fs.readFileSync(source, 'utf8')
const texturesDir = path.join(root, 'public', 'textures')
const dataDir = path.join(root, 'public', 'data', 'base')
fs.mkdirSync(texturesDir, { recursive: true })
fs.mkdirSync(dataDir, { recursive: true })

const texRe = /(\w+):\s*'data:image\/(\w+);base64,([A-Za-z0-9+/=]+)'/g
let match, count = 0
while ((match = texRe.exec(html)) !== null) {
  const [, name, ext, b64] = match
  const file = path.join(texturesDir, `${name}.${ext === 'jpeg' ? 'jpg' : ext}`)
  fs.writeFileSync(file, Buffer.from(b64, 'base64'))
  console.log(`纹理 ${name} → ${path.relative(root, file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`)
  count++
}

const dataMatch = html.match(/const DATA\s*=\s*(\[\{[\s\S]*?\}\]);/)
if (!dataMatch) {
  console.error('未能从附件中提取 DATA 数组')
  process.exit(1)
}
const data = JSON.parse(dataMatch[1])
fs.writeFileSync(path.join(dataDir, 'curated.json'), JSON.stringify(data))
console.log(`精选要素 ${data.length} 条 → public/data/base/curated.json`)
console.log(`完成：抽取 ${count} 张纹理`)
