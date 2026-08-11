import { describe, expect, it } from 'vitest'
import { initialState, legalActions } from '../domain/adapter'
import { stateToken } from '../domain/authority'
import { actionToEngineMove, engineLineForCandidate, validateEngineAnalysis } from './analysis'

function resultFor(variant: 'chess' | 'xiangqi' | 'shogi', actor: 'first' | 'second', token: string, pv: string[]) {
  return {
    schemaVersion: 1,
    status: 'available',
    stateToken: token,
    variant,
    actor,
    engine: {
      id: 'engine-id', name: 'Reviewed engine', version: '1', role: variant,
      sourceCommit: 'a'.repeat(40), binarySha256: 'b'.repeat(64), limitation: variant === 'shogi' ? 'classical-fallback' : 'specialist',
    },
    search: {
      perspective: 'root-side-to-move', rootActor: actor,
      limit: { movetimeMs: 1_500, threads: 1, hashMb: 32, multiPv: 5 },
      completedDepth: 12, nodes: 12_345, timeMs: 1_500,
    },
    lines: [{
      rank: 1, depth: 12, selDepth: 18, nodes: 12_345, timeMs: 1_500,
      score: { kind: 'centipawn', value: 34, bound: 'exact' }, pv,
    }],
  }
}

describe('bounded engine evidence client', () => {
  it('maps each board orientation and promotion notation', () => {
    expect(actionToEngineMove('chess', { kind: 'move', from: 'e7', to: 'e5', piece: 'pawn' })).toBe('e2e4')
    expect(actionToEngineMove('chess', { kind: 'move', from: 'a2', to: 'a1', piece: 'pawn', promotion: 'queen' })).toBe('a7a8q')
    expect(actionToEngineMove('xiangqi', { kind: 'move', from: 'b8', to: 'b5', piece: 'cannon' })).toBe('b2b5')
    expect(actionToEngineMove('shogi', { kind: 'move', from: 'c7', to: 'c6', piece: 'pawn' })).toBe('c3c4')
    expect(actionToEngineMove('shogi', { kind: 'drop', to: 'e5', piece: 'pawn' })).toBe('P@e5')
  })

  it('accepts bounded matching evidence and rejects stale or oversized evidence', () => {
    const state = initialState('chess', { sessionId: 'engine-test', now: '2026-01-01T00:00:00.000Z' })
    const token = stateToken(state)
    const valid = resultFor('chess', 'first', token, ['e2e4', 'e7e5'])
    expect(validateEngineAnalysis(valid, { variant: 'chess', actor: 'first', stateToken: token })).not.toBeNull()
    expect(validateEngineAnalysis({
      ...valid,
      engine: { ...valid.engine, networkSha256: 'c'.repeat(64) },
    }, { variant: 'chess', actor: 'first', stateToken: token })).not.toBeNull()
    expect(validateEngineAnalysis({
      ...valid,
      engine: { ...valid.engine, networkSha256: 'not-a-sha256' },
    }, { variant: 'chess', actor: 'first', stateToken: token })).toBeNull()
    expect(validateEngineAnalysis({ ...valid, stateToken: 'c'.repeat(64) }, { variant: 'chess', actor: 'first', stateToken: token })).toBeNull()
    expect(validateEngineAnalysis({ ...valid, lines: [{ ...valid.lines[0], pv: Array(65).fill('e2e4') }] }, { variant: 'chess', actor: 'first', stateToken: token })).toBeNull()
    expect(validateEngineAnalysis({ ...valid, search: { ...valid.search, limit: { ...valid.search.limit, threads: 4 } } }, { variant: 'chess', actor: 'first', stateToken: token })).toBeNull()
  })

  it('maps a line only to a same-position legal candidate', () => {
    const state = initialState('chess', { sessionId: 'candidate-engine-test', now: '2026-01-01T00:00:00.000Z' })
    const token = stateToken(state)
    const candidate = legalActions(state).find((item) => actionToEngineMove('chess', item.action) === 'e2e4')
    expect(candidate).toBeDefined()
    const analysis = validateEngineAnalysis(resultFor('chess', 'first', token, ['e2e4', 'e7e5']), {
      variant: 'chess', actor: 'first', stateToken: token,
    })
    expect(engineLineForCandidate(analysis, candidate!)).toMatchObject({ rank: 1 })
    expect(engineLineForCandidate(analysis, { ...candidate!, stateToken: 'd'.repeat(64) })).toBeNull()
  })
})
