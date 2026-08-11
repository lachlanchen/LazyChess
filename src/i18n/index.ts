import { catalogs } from './catalogs'
import type { Locale, Side, Variant } from '../domain/types'

export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const template = catalogs[locale][key] ?? catalogs.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function sideName(locale: Locale, variant: Variant, side: Side): string {
  return translate(locale, `side.${side}.${variant}`)
}

export const localeOptions: { id: Locale; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'zh-Hans', label: '中文' },
  { id: 'ja', label: '日本語' },
]
