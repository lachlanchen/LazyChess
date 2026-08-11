import { describe, expect, it } from 'vitest'
import { actionToEngineMove, parseEngineFen, parseInfoLine, validateEngineRequest } from './engine-analysis'

describe('engine analysis bridge boundaries', () => {
  const minimalChessPosition = {
    board: {
      e8: { side: 'first', kind: 'king' },
      e1: { side: 'second', kind: 'king' },
    },
    hands: { first: {}, second: {} },
  }

  it('accepts a bounded alternating history and maps it to engine coordinates', () => {
    const request = validateEngineRequest({
      schemaVersion: 1,
      variant: 'chess',
      ruleset: 'chess.js-1.4.0-standard',
      stateToken: 'a'.repeat(64),
      actor: 'second',
      history: [{ actor: 'first', action: { kind: 'move', from: 'e7', to: 'e5', piece: 'pawn' } }],
      position: minimalChessPosition,
    })
    expect(request).not.toBeNull()
    expect(actionToEngineMove('chess', request!.history[0].action)).toBe('e2e4')
  })

  it('rejects stale parity, injected coordinates, unknown rules, and unbounded history', () => {
    const base = {
      schemaVersion: 1,
      variant: 'chess',
      ruleset: 'chess.js-1.4.0-standard',
      stateToken: 'a'.repeat(64),
      actor: 'first',
      history: [],
      position: minimalChessPosition,
    }
    expect(validateEngineRequest({ ...base, actor: 'second' })).toBeNull()
    expect(validateEngineRequest({ ...base, ruleset: 'standard' })).toBeNull()
    expect(validateEngineRequest({
      ...base,
      position: { ...minimalChessPosition, board: { ...minimalChessPosition.board, a4: { side: 'first', kind: 'cannon' } } },
    })).toBeNull()
    expect(validateEngineRequest({
      ...base,
      position: { ...minimalChessPosition, board: { ...minimalChessPosition.board, e1: { side: 'first', kind: 'king' } } },
    })).toBeNull()
    expect(validateEngineRequest({ ...base, history: [{ actor: 'first', action: { kind: 'move', from: 'a7\nquit', to: 'a6', piece: 'pawn' } }] })).toBeNull()
    expect(validateEngineRequest({ ...base, history: Array.from({ length: 513 }, (_, index) => ({
      actor: index % 2 ? 'second' : 'first', action: { kind: 'move', from: 'a7', to: 'a6', piece: 'pawn' },
    })) })).toBeNull()
  })

  it('parses exact, bounded principal variations without treating bounds as certainty', () => {
    expect(parseInfoLine('chess', 'info depth 15 seldepth 22 multipv 2 score cp -31 lowerbound nodes 45001 time 907 pv d2d4 d7d5')).toEqual({
      rank: 2,
      depth: 15,
      selDepth: 22,
      nodes: 45001,
      timeMs: 907,
      score: { kind: 'centipawn', value: -31, bound: 'lower' },
      pv: ['d2d4', 'd7d5'],
    })
    expect(parseInfoLine('shogi', 'info depth 9 multipv 1 score mate -3 nodes 99 time 5 pv P@e5 e4e5+')).toMatchObject({
      score: { kind: 'mate', moves: -3, bound: 'exact' }, pv: ['P@e5', 'e4e5+'],
    })
    expect(parseInfoLine('chess', `info depth 5 score cp 2 nodes 2 time 1 pv ${'e2e4 '.repeat(65)}`)).toBeNull()
  })

  it('decodes engine board and Shogi hand state for deterministic position comparison', () => {
    expect(parseEngineFen('chess', 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toMatchObject({
      actor: 'second',
      board: { e5: { side: 'first', kind: 'pawn' }, e1: { side: 'second', kind: 'king' } },
      hands: { first: {}, second: {} },
    })
    expect(parseEngineFen('xiangqi', 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C2C4/9/RNBAKABNR b - - 1 1')).toMatchObject({
      actor: 'second', board: { e8: { side: 'first', kind: 'cannon' } },
    })
    expect(parseEngineFen('shogi', 'lnsgkgsnl/1r5b1/pp1pppppp/9/2p6/9/PP1PPPPPP/1B5R1/LNSGKGSNL[p] w - - 0 3')).toMatchObject({
      actor: 'first',
      board: { c5: { side: 'second', kind: 'pawn' } },
      hands: { first: {}, second: { pawn: 1 } },
    })
    expect(parseEngineFen('shogi', '9/9/9/4+P4/9/9/9/9/9[] w - - 0 1')?.board.e4).toEqual({
      side: 'first', kind: 'promoted-pawn',
    })
    expect(parseEngineFen('shogi', '9/9/9/9/4K4/9/9/9/4k4[PPp] w - - 0 1')?.hands).toEqual({
      first: { pawn: 2 }, second: { pawn: 1 },
    })
  })

  it('normalizes explicit zero Shogi hand counts after the last legal drop', () => {
    const base = {
      schemaVersion: 1,
      variant: 'shogi',
      ruleset: 'shogi-teaching-core-1',
      stateToken: 'b'.repeat(64),
      actor: 'first',
      history: [],
      position: {
        board: { e9: { side: 'first', kind: 'king' }, e1: { side: 'second', kind: 'king' } },
        hands: { first: { pawn: 18, rook: 2, lance: 0 }, second: { pawn: 18 } },
      },
    }

    expect(validateEngineRequest(base)?.position.hands.first).toEqual({ pawn: 18, rook: 2 })
    expect(validateEngineRequest({
      ...base,
      position: { ...base.position, hands: { first: { pawn: -1 }, second: {} } },
    })).toBeNull()
  })
})
