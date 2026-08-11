import { describe, expect, it } from 'vitest'
import { SUPPORTED_LOCALES } from '../domain/types'
import {
  ANALYSIS_CATALOG_KEYS,
  analysisCatalogs,
  type AnalysisCatalogKey,
} from './analysisCatalogs'
import { catalogs } from './catalogs'
import { translate } from './index'

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort()
}

const modes = ['current', 'suggested', 'hover', 'selected'] as const
const layers = ['control', 'safety', 'lanes', 'king'] as const
const legends = [
  'actorControl', 'opponentControl', 'contested', 'defended', 'attackedDefended', 'loose',
  'actorLane', 'opponentLane', 'cannonScreen', 'actorKing', 'opponentKing', 'hostileRing',
] as const
const exchanges = [
  'quiet', 'unanswered-gain', 'favorable-if-recaptured', 'even-if-recaptured',
  'costly-if-recaptured', 'exposed-mover',
] as const
const planKeys = [
  'plan.win-material',
  'plan.force-king-response',
  'plan.improve-control',
  'plan.reduce-king-danger',
  'chess.plan.develop-minor',
  'chess.plan.contest-center',
  'xiangqi.plan.cross-river',
  'xiangqi.plan.press-palace',
  'xiangqi.plan.use-cannon-screen',
  'shogi.plan.enter-promotion-zone',
  'shogi.plan.open-bishop-diagonal',
  'shogi.plan.use-hand',
  'shogi.plan.press-camp',
] as const
const rankFactors = [
  'legal', 'forcing-check', 'capture-outlook', 'promotion', 'reduce-own-king-ring',
  'increase-own-king-ring', 'rescue-piece', 'leave-piece-attacked-undefended',
  'create-attacked-undefended-target', 'net-control',
] as const
const unavailableReasons = [
  'not-installed', 'verification-failed', 'invalid-position', 'search-failed', 'busy',
] as const
const accessibleMapKeys = [
  'map.a11y.control',
  'map.a11y.safety.king',
  'map.a11y.lanes',
  'map.a11y.kingZone',
  'map.a11y.kingEscape',
  'map.a11y.change.gained',
  'map.a11y.change.lost',
  'map.a11y.change.strengthened',
  'map.a11y.change.weakened',
  'map.a11y.change.newly-loose',
  'map.a11y.change.rescued',
  'map.a11y.change.newly-attacked',
] as const

const requiredKeys = [
  'map.title',
  'map.layers',
  ...modes.map((mode) => `map.mode.${mode}`),
  ...layers.map((layer) => `map.layer.${layer}`),
  ...legends.map((legend) => `map.legend.${legend}`),
  ...accessibleMapKeys,
  'map.metric.controlCurrent',
  'map.metric.controlDelta',
  'map.metric.mobility',
  'map.metric.replies',
  'map.metric.kingCurrent',
  'map.metric.kingDelta',
  'map.metric.exchange',
  'map.metric.loose',
  'map.kingDelta.safer',
  'map.kingDelta.exposed',
  'map.kingDelta.same',
  ...exchanges.map((exchange) => `map.exchange.${exchange}`),
  'map.exchange.basis',
  'map.plan',
  'map.plan.scan',
  'map.replies',
  'map.threats',
  'map.threat.check',
  'map.threat.mate',
  'map.threat.count',
  'map.threat.none',
  'map.threat.caveat',
  ...planKeys,
  ...rankFactors.map((factor) => `rank.${factor}`),
  'candidate.engineSubtitle',
  'engine.title',
  'engine.offline',
  'engine.body',
  'engine.setup',
  'engine.searching',
  'engine.searchingBody',
  'engine.rootPerspective',
  'engine.principalVariation',
  'engine.limitation.specialist',
  'engine.limitation.classical-fallback',
  'engine.searchLimit',
  'engine.provenance',
  ...unavailableReasons.map((reason) => `engine.reason.${reason}`),
  'engine.rank',
  'engine.depth',
  'engine.nodes',
  'engine.seconds',
  'engine.evaluation',
  'engine.mate',
  'engine.bound.lower',
  'engine.bound.upper',
] as const

describe('position-map and engine analysis catalogs', () => {
  it('covers every current static and bounded dynamic key exactly once', () => {
    expect(ANALYSIS_CATALOG_KEYS).toHaveLength(110)
    expect([...ANALYSIS_CATALOG_KEYS].sort()).toEqual([...requiredKeys].sort())
  })

  it('keeps all 11 locale keys and interpolation placeholders in strict parity', () => {
    const baseline = [...ANALYSIS_CATALOG_KEYS].sort()
    expect(Object.keys(analysisCatalogs)).toEqual([...SUPPORTED_LOCALES])

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(analysisCatalogs[locale]).sort(), locale).toEqual(baseline)
      for (const key of ANALYSIS_CATALOG_KEYS) {
        const translated = analysisCatalogs[locale][key]
        expect(translated.trim(), `${locale}:${key}`).not.toBe('')
        expect(placeholders(translated), `${locale}:${key}`).toEqual(
          placeholders(analysisCatalogs.en[key]),
        )
        expect(catalogs[locale][key], `${locale}:${key}`).toBe(translated)
      }
    }
  })

  it('renders every placeholder-bearing analysis message without leaking a raw key or token', () => {
    const values = {
      count: 2,
      side: 'White',
      actor: 'White',
      actorCount: 3,
      opponent: 'Black',
      opponentCount: 2,
      milliseconds: 800,
      lines: 3,
      rank: 1,
      depth: 18,
      nodes: '12K',
      seconds: '0.8',
      score: '+0.35',
      moves: '+3',
    }
    for (const locale of SUPPORTED_LOCALES) {
      for (const key of ANALYSIS_CATALOG_KEYS) {
        const rendered = translate(locale, key, values)
        expect(rendered, `${locale}:${key}`).not.toBe(key)
        expect(rendered, `${locale}:${key}`).not.toMatch(/\{\w+\}/)
      }
    }
  })

  it('localizes the key teaching and engine states rather than falling back to English', () => {
    const mustLocalize: AnalysisCatalogKey[] = [
      'map.title',
      'map.mode.current',
      'map.legend.hostileRing',
      'map.a11y.control',
      'map.threat.mate',
      'map.threat.caveat',
      'plan.win-material',
      'shogi.plan.open-bishop-diagonal',
      'candidate.engineSubtitle',
      'engine.title',
      'engine.offline',
      'engine.body',
      'engine.searchingBody',
      'engine.rootPerspective',
      'engine.provenance',
      'engine.reason.verification-failed',
    ]
    for (const locale of SUPPORTED_LOCALES.filter((item) => item !== 'en')) {
      for (const key of mustLocalize) {
        expect(analysisCatalogs[locale][key], `${locale}:${key}`).not.toBe(analysisCatalogs.en[key])
      }
    }
  })

  it('keeps engine and calculated-map provenance honest in the canonical copy', () => {
    expect(analysisCatalogs.en['candidate.engineSubtitle']).toMatch(/engine-ranked lines first/i)
    expect(analysisCatalogs.en['candidate.engineSubtitle']).toMatch(/authored fallback/i)
    expect(analysisCatalogs.en['candidate.engineSubtitle']).toMatch(/position-bound/i)
    expect(analysisCatalogs.en['map.replies']).toMatch(/heuristic, not forced/i)
    expect(analysisCatalogs.en['map.threat.caveat']).toMatch(/not a searched capture forecast/i)
    expect(analysisCatalogs.en['map.threat.mate']).toMatch(/game ends.+no legal reply/i)
    expect(analysisCatalogs.en['map.exchange.basis']).toMatch(/calculated contact.+authored piece-value scale/i)
    expect(analysisCatalogs.en['plan.win-material']).toMatch(/capture material.+verify the recapture/i)
    expect(analysisCatalogs.en['engine.title']).toMatch(/bounded engine analysis/i)
    expect(analysisCatalogs.en['engine.offline']).toBe('No verified engine result')
    expect(analysisCatalogs.en['engine.body']).toMatch(/optional bounded real-engine lane/i)
    expect(analysisCatalogs.en['engine.body']).toMatch(/No engine score is claimed/i)
    expect(analysisCatalogs.en['engine.body']).toMatch(/legal candidates remain exact/i)
    expect(analysisCatalogs.en['engine.body']).toMatch(/labeled authored/i)
    expect(analysisCatalogs.en['engine.searchingBody']).toMatch(/rule-owned/i)
    expect(analysisCatalogs.en['engine.rootPerspective']).toMatch(/native scale.+not comparable across variants/i)
    expect(analysisCatalogs.en['engine.limitation.classical-fallback']).toMatch(/not a native specialist/i)
  })
})
