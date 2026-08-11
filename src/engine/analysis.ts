import type { Action, Candidate, GameState, Side, Variant } from '../domain/types'

export type EngineScore =
  | { kind: 'centipawn'; value: number; bound: 'exact' | 'lower' | 'upper' }
  | { kind: 'mate'; moves: number; bound: 'exact' | 'lower' | 'upper' }

export interface EnginePrincipalVariation {
  rank: number
  depth: number
  selDepth?: number
  nodes: number
  timeMs: number
  score: EngineScore
  pv: string[]
}

export interface AvailableEngineAnalysis {
  schemaVersion: 1
  status: 'available'
  stateToken: string
  variant: Variant
  actor: Side
  engine: {
    id: string
    name: string
    version: string
    role: string
    sourceCommit: string
    binarySha256: string
    networkSha256?: string
    limitation: 'specialist' | 'classical-fallback'
  }
  search: {
    perspective: 'root-side-to-move'
    rootActor: Side
    limit: { movetimeMs: number; threads: 1; hashMb: number; multiPv: number }
    completedDepth: number
    nodes: number
    timeMs: number
  }
  lines: EnginePrincipalVariation[]
}

export interface UnavailableEngineAnalysis {
  schemaVersion: 1
  status: 'unavailable'
  stateToken: string
  variant: Variant
  actor: Side
  reason: 'not-installed' | 'verification-failed' | 'invalid-position' | 'search-failed' | 'busy'
}

export type EngineAnalysis = AvailableEngineAnalysis | UnavailableEngineAnalysis

const UNAVAILABLE_REASONS = new Set<UnavailableEngineAnalysis['reason']>([
  'not-installed', 'verification-failed', 'invalid-position', 'search-failed', 'busy',
])
const VARIANTS = new Set<Variant>(['chess', 'xiangqi', 'shogi'])
const SIDES = new Set<Side>(['first', 'second'])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function boundedString(value: unknown, maximum = 160): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum
}

function safeInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum
}

function engineMovePattern(variant: Variant): RegExp {
  if (variant === 'chess') return /^[a-h][1-8][a-h][1-8][qrbn]?$/
  if (variant === 'xiangqi') return /^[a-i][0-9][a-i][0-9]$/
  return /^(?:[a-i][1-9][a-i][1-9][+=]?|[PLNSGBR]@[a-i][1-9])$/
}

function validLine(value: unknown, variant: Variant): value is EnginePrincipalVariation {
  if (!record(value)) return false
  if (!safeInteger(value.rank, 1, 5) || !safeInteger(value.depth, 1, 256)) return false
  if (value.selDepth !== undefined && !safeInteger(value.selDepth, 1, 512)) return false
  if (!safeInteger(value.nodes, 0, Number.MAX_SAFE_INTEGER) || !safeInteger(value.timeMs, 0, 10_000)) return false
  if (!record(value.score) || (value.score.bound !== 'exact' && value.score.bound !== 'lower' && value.score.bound !== 'upper')) return false
  if (value.score.kind === 'centipawn') {
    if (!safeInteger(value.score.value, -100_000_000, 100_000_000)) return false
  } else if (value.score.kind === 'mate') {
    if (!safeInteger(value.score.moves, -100_000, 100_000)) return false
  } else return false
  if (!Array.isArray(value.pv) || value.pv.length === 0 || value.pv.length > 64) return false
  const pattern = engineMovePattern(variant)
  return value.pv.every((move) => typeof move === 'string' && pattern.test(move))
}

export function validateEngineAnalysis(
  value: unknown,
  expected: Pick<GameState, 'variant' | 'actor'> & { stateToken: string },
): EngineAnalysis | null {
  if (!record(value) || value.schemaVersion !== 1 || value.stateToken !== expected.stateToken) return null
  if (
    value.variant !== expected.variant || value.actor !== expected.actor
    || !VARIANTS.has(value.variant as Variant) || !SIDES.has(value.actor as Side)
  ) return null
  if (value.status === 'unavailable') {
    if (!UNAVAILABLE_REASONS.has(value.reason as UnavailableEngineAnalysis['reason'])) return null
    return value as unknown as UnavailableEngineAnalysis
  }
  if (value.status !== 'available' || !record(value.engine) || !record(value.search) || !record(value.search.limit)) return null
  if (
    !boundedString(value.engine.id) || !boundedString(value.engine.name) || !boundedString(value.engine.version)
    || !boundedString(value.engine.role) || !/^[a-f0-9]{40}$/.test(String(value.engine.sourceCommit))
    || !/^[a-f0-9]{64}$/.test(String(value.engine.binarySha256))
    || (value.engine.networkSha256 !== undefined && !/^[a-f0-9]{64}$/.test(String(value.engine.networkSha256)))
    || (value.engine.limitation !== 'specialist' && value.engine.limitation !== 'classical-fallback')
  ) return null
  if (value.search.perspective !== 'root-side-to-move' || value.search.rootActor !== expected.actor) return null
  if (
    value.search.limit.threads !== 1 || !safeInteger(value.search.limit.movetimeMs, 100, 2_500)
    || !safeInteger(value.search.limit.hashMb, 1, 64) || !safeInteger(value.search.limit.multiPv, 1, 5)
    || !safeInteger(value.search.completedDepth, 1, 256) || !safeInteger(value.search.nodes, 0, Number.MAX_SAFE_INTEGER)
    || !safeInteger(value.search.timeMs, 0, 10_000)
  ) return null
  if (!Array.isArray(value.lines) || value.lines.length === 0 || value.lines.length > value.search.limit.multiPv) return null
  if (!value.lines.every((line) => validLine(line, expected.variant))) return null
  const ranks = value.lines.map((line) => line.rank)
  if (ranks[0] !== 1 || new Set(ranks).size !== ranks.length || ranks.some((rank, index) => index > 0 && rank <= ranks[index - 1])) return null
  return value as unknown as AvailableEngineAnalysis
}

function engineCoordinate(variant: Variant, coordinate: string): string {
  const rank = Number(coordinate.slice(1))
  return `${coordinate[0]}${variant === 'chess' ? 9 - rank : 10 - rank}`
}

const DROP_LETTER: Partial<Record<Action['piece'], string>> = {
  pawn: 'P', lance: 'L', knight: 'N', silver: 'S', gold: 'G', bishop: 'B', rook: 'R', king: 'K',
}

export function actionToEngineMove(variant: Variant, action: Action): string | null {
  if (action.kind === 'drop') {
    const letter = DROP_LETTER[action.piece]
    return letter ? `${letter}@${engineCoordinate(variant, action.to)}` : null
  }
  if (!action.from) return null
  const base = `${engineCoordinate(variant, action.from)}${engineCoordinate(variant, action.to)}`
  if (variant === 'chess' && action.promotion) {
    const suffix: Partial<Record<Action['piece'], string>> = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }
    const promotion = suffix[action.promotion]
    return promotion ? `${base}${promotion}` : null
  }
  return variant === 'shogi' && action.promote ? `${base}+` : base
}

function normalizeEngineMove(variant: Variant, move: string): string {
  return variant === 'shogi' && move.endsWith('=') ? move.slice(0, -1) : move
}

export function engineLineForCandidate(
  analysis: EngineAnalysis | null,
  candidate: Candidate,
): EnginePrincipalVariation | null {
  if (!analysis || analysis.status !== 'available') return null
  if (analysis.stateToken !== candidate.stateToken || analysis.actor !== candidate.actor) return null
  const expected = actionToEngineMove(analysis.variant, candidate.action)
  if (!expected) return null
  return analysis.lines.find((line) => normalizeEngineMove(analysis.variant, line.pv[0] ?? '') === expected) ?? null
}

function unavailable(state: GameState, stateToken: string, reason: UnavailableEngineAnalysis['reason']): UnavailableEngineAnalysis {
  return { schemaVersion: 1, status: 'unavailable', stateToken, variant: state.variant, actor: state.actor, reason }
}

export async function requestEngineAnalysis(
  state: GameState,
  stateToken: string,
  signal?: AbortSignal,
): Promise<EngineAnalysis> {
  let response: Response
  try {
    response = await fetch('/api/engine-analysis', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 1,
        variant: state.variant,
        ruleset: state.ruleset,
        stateToken,
        actor: state.actor,
        history: state.moves.map(({ actor, action }) => ({ actor, action })),
        position: { board: state.board, hands: state.hands },
      }),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return unavailable(state, stateToken, 'search-failed')
  }
  if (!response.ok) return unavailable(state, stateToken, 'search-failed')
  let decoded: unknown
  try {
    decoded = await response.json()
  } catch {
    return unavailable(state, stateToken, 'search-failed')
  }
  return validateEngineAnalysis(decoded, { variant: state.variant, actor: state.actor, stateToken })
    ?? unavailable(state, stateToken, 'search-failed')
}
