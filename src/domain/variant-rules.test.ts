import { describe, expect, it } from 'vitest'
import { initialState, legalActions } from './adapter'
import { shogiTesting } from './shogi'
import { xiangqiTesting } from './xiangqi'
import type { GameState } from './types'

const options = { sessionId: 'rules-test', now: '2026-08-11T00:00:00.000Z' }

describe('Xiangqi teaching-core legality', () => {
  it('honors a horse leg block', () => {
    const board = xiangqiTesting.initialBoard()
    expect(xiangqiTesting.rawDestinations(board, 'b10')).toContain('a8')
    board.b9 = { side: 'first', kind: 'pawn' }
    expect(xiangqiTesting.rawDestinations(board, 'b10')).not.toContain('a8')
    expect(xiangqiTesting.rawDestinations(board, 'b10')).not.toContain('c8')
  })

  it('requires exactly one cannon screen for a capture', () => {
    const board = xiangqiTesting.initialBoard()
    expect(xiangqiTesting.rawDestinations(board, 'b8')).not.toContain('b3')
    board.b6 = { side: 'first', kind: 'pawn' }
    expect(xiangqiTesting.rawDestinations(board, 'b8')).toContain('b3')
  })

  it('never permits an elephant to cross the river', () => {
    const board = xiangqiTesting.initialBoard()
    board.c6 = { side: 'first', kind: 'elephant' }
    expect(xiangqiTesting.rawDestinations(board, 'c6')).not.toContain('e4')
  })
})

describe('Shogi teaching-core legality', () => {
  it('offers the ordinary opening pawn advance', () => {
    const state = initialState('shogi', options)
    expect(legalActions(state).some((item) => item.action.from === 'a7' && item.action.to === 'a6')).toBe(true)
  })

  it('enforces nifu while allowing a pawn drop on a cleared file', () => {
    const state = initialState('shogi', options)
    state.hands.first.pawn = 1
    expect(shogiTesting.allActions(state, 'first').some((action) => action.kind === 'drop' && action.piece === 'pawn')).toBe(false)
    delete state.board.a7
    const drops = shogiTesting.allActions(state, 'first').filter((action) => action.kind === 'drop' && action.piece === 'pawn')
    expect(drops.length).toBeGreaterThan(0)
    expect(drops.some((action) => action.to === 'a1')).toBe(false)
  })

  it('offers optional promotion when a pawn enters the zone', () => {
    const state = initialState('shogi', options)
    state.board = {
      e9: { side: 'first', kind: 'king' },
      e1: { side: 'second', kind: 'king' },
      a4: { side: 'first', kind: 'pawn' },
    }
    const actions = shogiTesting.allActions(state as GameState, 'first').filter((action) => action.from === 'a4' && action.to === 'a3')
    expect(actions).toHaveLength(2)
    expect(actions.some((action) => action.promote)).toBe(true)
    expect(actions.some((action) => !action.promote)).toBe(true)
  })
})
