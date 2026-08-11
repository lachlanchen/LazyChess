import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES } from '../domain/types'
import { catalogs } from './catalogs'
import { isSupportedLocale, localeOptions } from './index'

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort()
}

describe('message catalogs', () => {
  it('keeps every supported catalog and interpolation contract aligned', () => {
    const baseline = Object.keys(catalogs.en).sort()
    expect(Object.keys(catalogs)).toEqual([...SUPPORTED_LOCALES])
    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(catalogs[locale]).sort()).toEqual(baseline)
      for (const key of baseline) {
        expect(placeholders(catalogs[locale][key]!)).toEqual(placeholders(catalogs.en[key]!))
      }
    }
  })

  it('allowlists persisted locales and exposes one selector option per locale', () => {
    expect(localeOptions.map((option) => option.id)).toEqual([...SUPPORTED_LOCALES])
    for (const locale of SUPPORTED_LOCALES) expect(isSupportedLocale(locale)).toBe(true)
    expect(isSupportedLocale('en<script>')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
  })
})
