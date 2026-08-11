import { describe, expect, it } from 'vitest'
import { applyAction, initialState, legalActions, previewCandidate } from './adapter'
import { teachingFacets } from './teaching'
import type { Candidate, GameState } from './types'
import { translate } from '../i18n'

const now = '2026-08-11T00:00:00.000Z'

function choose(state: GameState, from: string, to: string): Candidate {
  const candidate = legalActions(state).find((item) => item.action.from === from && item.action.to === to)
  if (!candidate) throw new Error(`Missing candidate ${from}-${to}`)
  return candidate
}

function commit(state: GameState, from: string, to: string, request: string): GameState {
  const candidate = choose(state, from, to)
  const result = applyAction(state, {
    candidateId: candidate.id,
    stateToken: candidate.stateToken,
    actor: candidate.actor,
    clientRequestId: request,
  }, now)
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

describe('deterministic teaching facts', () => {
  it('identifies an en-passant capture from the before/after boards', () => {
    let state = initialState('chess', { sessionId: 'en-passant-teaching', now })
    state = commit(state, 'e7', 'e5', 'move-1')
    state = commit(state, 'a2', 'a3', 'move-2')
    state = commit(state, 'e5', 'e4', 'move-3')
    state = commit(state, 'd2', 'd4', 'move-4')
    const candidate = choose(state, 'e4', 'd3')
    const after = previewCandidate(state, candidate)

    expect(after).not.toBeNull()
    expect(after?.board.d4).toBeUndefined()
    const facets = teachingFacets(state, after!, candidate)
    expect(facets[0].bodyKey).toBe('teach.exact.capture')
    expect(facets[1].bodyKey).toBe('teach.strategy.capture')
    expect(translate('en', facets[0].bodyKey, facets[0].params)).toBe('exd6 moves to d6 and removes an opposing piece.')
  })

  it('labels a checkmating preview as an exact terminal state with no reply', () => {
    let state = initialState('chess', { sessionId: 'fools-mate-teaching', now })
    state = commit(state, 'f7', 'f6', 'mate-1')
    state = commit(state, 'e2', 'e4', 'mate-2')
    state = commit(state, 'g7', 'g5', 'mate-3')
    const candidate = choose(state, 'd1', 'h5')
    const after = previewCandidate(state, candidate)

    expect(candidate.notation).toBe('Qh4#')
    expect(after?.status).toMatchObject({ phase: 'complete', reason: 'checkmate', inCheck: true })
    const reply = teachingFacets(state, after!, candidate)[2]
    expect(reply).toMatchObject({
      evidence: 'exact',
      titleKey: 'teach.reply.terminalTitle',
      bodyKey: 'teach.reply.terminal',
    })
    expect(reply.bodyKey).not.toBe('teach.reply.check')
  })
})
