import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'

describe('message catalogs', () => {
  it('keeps English, Simplified Chinese, and Japanese keys aligned', () => {
    const baseline = Object.keys(catalogs.en).sort()
    expect(Object.keys(catalogs['zh-Hans']).sort()).toEqual(baseline)
    expect(Object.keys(catalogs.ja).sort()).toEqual(baseline)
  })
})
