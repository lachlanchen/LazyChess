import { catalogs } from './catalogs'
import { SUPPORTED_LOCALES, type Locale, type Side, type Variant } from '../domain/types'

export function translate(locale: Locale, key: string, params: Record<string, string | number> = {}): string {
  const template = catalogs[locale][key] ?? catalogs.en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`))
}

export function sideName(locale: Locale, variant: Variant, side: Side): string {
  return translate(locale, `side.${side}.${variant}`)
}

export function isSupportedLocale(value: string | null): value is Locale {
  return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export const localeOptions: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ar', label: 'العربية' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'zh-Hans', label: '简体中文' },
  { id: 'zh-Hant', label: '繁體中文' },
  { id: 'de', label: 'Deutsch' },
  { id: 'ru', label: 'Русский' },
]
