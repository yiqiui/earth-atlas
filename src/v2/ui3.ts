import { ALL_LAYERS, CAT_COLOR, DEFAULT_LAYERS, ZONE_COLOR, type Cat } from './config2'
import { LANGS, lang, setLanguage, t, catLabel, type Lang } from './i18n2'
import { ZONE_ZH } from './palette'

export interface Ui3Callbacks {
  onToggleCat(cats: Cat[], on: boolean): void
  onSurface(kind: 'relief' | 'satellite'): void
  onToggleTiles(on: boolean): void
  onClouds(on: boolean): void
  onGrid(on: boolean): void
  onExaggeration(v: number): void
  onReset(): void
  onSelect(id: string): void
  onLang(l: Lang): void
  onSearch(q: string): { id: string; name: string; cat: Cat }[]
}

function el<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T }

export class Ui3 {
  private results = el('search-results')
  private searchInput = el<HTMLInputElement>('search')

  constructor(private cb: Ui3Callbacks) {
    this.buildLang()
    this.buildLayers()
    this.buildLegend()
    this.bind()
    this.applyText()
  }

  private buildLang(): void {
    const sel = el<HTMLSelectElement>('lang-select')
    sel.replaceChildren()
    for (const l of LANGS) { const o = document.createElement('option'); o.value = l.code; o.textContent = l.native; sel.appendChild(o) }
    sel.value = lang()
    sel.addEventListener('change', () => { setLanguage(sel.value as Lang); this.applyText(); this.buildLayers(); this.cb.onLang(sel.value as Lang) })
  }

  private buildLayers(): void {
    const host = el('layers')
    const prev = new Set([...host.querySelectorAll<HTMLInputElement>('input[data-cat]')].filter(i => i.checked).map(i => i.dataset.cat as Cat))
    const first = prev.size === 0
    host.replaceChildren()
    for (const cat of ALL_LAYERS) {
      const on = first ? this.defaultOn(cat) : prev.has(cat)
      const label = document.createElement('label')
      label.className = 'layer-item'
      label.innerHTML = `<input type="checkbox" ${on ? 'checked' : ''} data-cat="${cat}"><span class="swatch" style="background:${CAT_COLOR[cat]}"></span>${catLabel(cat)}`
      label.querySelector('input')!.addEventListener('change', e => this.cb.onToggleCat([cat], (e.target as HTMLInputElement).checked))
      host.appendChild(label)
    }
  }

  private defaultOn(cat: Cat): boolean {
    // 与 DEFAULT_LAYERS 同一数据源；专题图层默认关闭，勾选后才叠加。
    return DEFAULT_LAYERS.includes(cat)
  }

  private buildLegend(): void {
    const zones = Object.entries(ZONE_COLOR).map(([zone, color]) =>
      `<span style="margin-right:8px;white-space:nowrap"><i style="background:${color}"></i>${ZONE_ZH[zone] ?? zone}</span>`).join('')
    el('legend').innerHTML = `
      <span><i style="background:linear-gradient(90deg,#2e6a9e,#7ec87a,#d4b060,#b0563c,#fff)"></i>${t('reliefH')}</span>
      <span><i style="background:#54bcd8"></i>${catLabel('river')}</span>
      <span><i style="background:#79b8c6"></i>${catLabel('fjord')}</span>
      <details class="zone-legend"><summary>${t('climate')}色标</summary><div style="line-height:1.7;margin-top:4px">${zones}</div></details>`
  }

  private applyText(): void {
    document.querySelector('.brand p')!.textContent = t('subtitle')
    document.querySelector('.brand .cn')!.textContent = t('cats')
    this.searchInput.placeholder = t('search')
    el('btn-relief').title = t('relief')
    el('btn-satellite').title = t('satellite')
    el('btn-clouds').title = t('clouds')
    el('btn-grid').title = t('grid')
    el('btn-reset').title = t('reset')
    el('view-title').textContent = t('view')
    el('layers-title').textContent = t('layers')
    el('exagg-label').textContent = t('exaggeration')
    const note = document.querySelector('.teaching-note')
    if (note) note.textContent = t('note')
    const legend = el('legend')
    if (!legend.parentElement?.querySelector('.teaching-note')) {
      const d = document.createElement('div'); d.className = 'teaching-note'; d.textContent = t('note')
      legend.parentElement?.appendChild(d)
    }
    this.buildLegend()
  }

  private bind(): void {
    const toggle = (id: string, fn: (on: boolean) => void) => {
      const btn = el<HTMLButtonElement>(id)
      btn.classList.toggle('active', btn.getAttribute('aria-pressed') === 'true')
      btn.addEventListener('click', () => {
        const on = btn.getAttribute('aria-pressed') !== 'true'
        btn.setAttribute('aria-pressed', String(on)); btn.classList.toggle('active', on); fn(on)
      })
    }
    el('btn-relief').addEventListener('click', () => this.setSurface('relief'))
    el('btn-satellite').addEventListener('click', () => this.setSurface('satellite'))
    toggle('btn-tiles', on => this.cb.onToggleTiles(on))
    toggle('btn-clouds', on => this.cb.onClouds(on))
    toggle('btn-grid', on => this.cb.onGrid(on))
    el('btn-reset').addEventListener('click', () => this.cb.onReset())
    const slider = el<HTMLInputElement>('exagg')
    slider.addEventListener('input', () => {
      el('exagg-val').textContent = `${slider.value}×`
      this.cb.onExaggeration(Number(slider.value))
    })
    let timer = 0
    this.searchInput.addEventListener('input', () => {
      clearTimeout(timer)
      timer = window.setTimeout(() => this.showResults(this.cb.onSearch(this.searchInput.value.trim())), 150)
    })
    this.searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.results.querySelector('button')?.click()
      else if (e.key === 'Escape') this.hideResults()
    })
  }

  private setSurface(kind: 'relief' | 'satellite'): void {
    el('btn-relief').classList.toggle('active', kind === 'relief')
    el('btn-satellite').classList.toggle('active', kind === 'satellite')
    this.cb.onSurface(kind)
  }

  private showResults(items: { id: string; name: string; cat: Cat }[]): void {
    this.results.replaceChildren()
    if (!items.length) { this.hideResults(); return }
    for (const it of items.slice(0, 24)) {
      const b = document.createElement('button')
      b.innerHTML = `${it.name}<small>${catLabel(it.cat)}</small>`
      b.addEventListener('click', () => { this.cb.onSelect(it.id); this.hideResults() })
      this.results.appendChild(b)
    }
    this.results.hidden = false
  }
  private hideResults(): void { this.results.hidden = true }

  setStatus(source: string, online: string, count: number): void {
    el('status-source').textContent = `${t('src')}：${source}`
    el('status-online').textContent = `${t('online')}：${online}`
    el('status-count').textContent = `${count} ${t('features')}`
  }
  /** 供主程序同步按钮状态（如地形夸张时自动停用影像瓦片）。 */
  setToggle(id: string, on: boolean): void {
    const btn = el<HTMLButtonElement>(id)
    btn.setAttribute('aria-pressed', String(on))
    btn.classList.toggle('active', on)
  }
  setCoord(s: string): void { el('status-coord').textContent = s }
  setCount(n: number): void { el('feature-count').textContent = String(n) }
  toast(msg: string): void {
    const tst = el('toast'); tst.textContent = msg; tst.hidden = false
    ;(tst as any)._timer && clearTimeout((tst as any)._timer)
    ;(tst as any)._timer = window.setTimeout(() => { tst.hidden = true }, 3200)
  }
}
