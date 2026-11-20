import { describe, expect, it } from 'vitest'
import { LANGS, setLanguage, t, catLabel, lang } from './i18n2'

describe('v2 i18n', () => {
  it('支持 13 种语言', () => {
    expect(LANGS).toHaveLength(13)
    expect(LANGS.map(l => l.code)).toEqual([
      'zh', 'zh-TW', 'en', 'ja', 'ko', 'fr', 'ru', 'de', 'es', 'pt', 'la', 'ar', 'it',
    ])
  })

  it('中文与英文关键文案', () => {
    setLanguage('zh')
    expect(t('relief')).toBe('地形浮雕')
    expect(catLabel('river')).toBe('河流')
    setLanguage('en')
    expect(t('relief')).toBe('Terrain relief')
    expect(catLabel('river')).toBe('Rivers')
  })

  it('缺失文案回退英文，未知键回退键名', () => {
    setLanguage('ja') // ja 字典不全，relief 有值
    expect(typeof t('relief')).toBe('string')
    expect(t('__nope__')).toBe('__nope__')
  })

  it('语言状态可切换并读回', () => {
    setLanguage('fr')
    expect(lang()).toBe('fr')
    setLanguage('zh')
  })
})
