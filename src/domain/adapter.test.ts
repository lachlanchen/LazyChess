import { describe, expect, it } from 'vitest'
import { applyAction, initialState, legalActions, previewCandidate } from './adapter'
import { stateToken } from './authority'

const options = { sessionId: 'session-a', now: '2026-08-11T00:00:00.000Z' }

describe('deterministic adapter', () => {
  it('offers the twenty standard opening chess moves and excludes a three-square pawn move', () => {
    const state = initialState('chess', options)
    const candidates = legalActions(state)
    expect(candidates).toHaveLength(20)
    expect(candidates.some((item) => item.action.from === 'e7' && item.action.to === 'e5')).toBe(true)
    expect(candidates.some((item) => item.action.from === 'e7' && item.action.to === 'e4')).toBe(false)
  })

  it('binds a candidate to state, actor, and action and rejects it after the position changes', () => {
    const state = initialState('chess', options)
    const candidate = legalActions(state).find((item) => item.action.from === 'e7' && item.action.to === 'e5')!
    expect(candidate.stateToken).toBe(stateToken(state))
    expect(candidate.id).toMatch(/^cand_[0-9a-f]{64}$/)
    const first = applyAction(state, {
      candidateId: candidate.id,
      stateToken: candidate.stateToken,
      actor: candidate.actor,
      clientRequestId: 'move-1',
    }, '2026-08-11T00:01:00.000Z')
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.state.revision).toBe(1)
    const stale = applyAction(first.state, {
      candidateId: candidate.id,
      stateToken: candidate.stateToken,
      actor: candidate.actor,
      clientRequestId: 'move-2',
    })
    expect(stale).toMatchObject({ ok: false, reason: 'stale-state' })
  })

  it('replays an idempotent request without a second move', () => {
    const state = initialState('chess', options)
    const candidate = legalActions(state)[0]
    const selection = { candidateId: candidate.id, stateToken: candidate.stateToken, actor: candidate.actor, clientRequestId: 'same-request' }
    const first = applyAction(state, selection)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const repeated = applyAction(first.state, selection)
    expect(repeated).toMatchObject({ ok: true, replayed: true })
    if (repeated.ok) expect(repeated.state.moves).toHaveLength(1)
  })

  it('rejects reuse of an idempotency key with a different candidate payload', () => {
    const state = initialState('chess', options)
    const [firstCandidate, secondCandidate] = legalActions(state)
    const first = applyAction(state, {
      candidateId: firstCandidate.id,
      stateToken: firstCandidate.stateToken,
      actor: firstCandidate.actor,
      clientRequestId: 'bound-request',
    })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const conflicting = applyAction(first.state, {
      candidateId: secondCandidate.id,
      stateToken: secondCandidate.stateToken,
      actor: secondCandidate.actor,
      clientRequestId: 'bound-request',
    })
    expect(conflicting).toMatchObject({ ok: false, reason: 'idempotency-conflict' })
    expect(conflicting.state.moves).toHaveLength(1)
  })

  it('keeps preview immutable and does not advance revision', () => {
    const state = initialState('chess', options)
    const before = JSON.stringify(state)
    const candidate = legalActions(state)[0]
    const preview = previewCandidate(state, candidate)
    expect(JSON.stringify(state)).toBe(before)
    expect(preview?.board).not.toEqual(state.board)
    expect(preview?.revision).toBe(state.revision)
  })

  it('never supplies actions for a non-acting player', () => {
    const state = initialState('xiangqi', options)
    expect(legalActions(state, 'second')).toEqual([])
  })

  it('preserves standard chess castling through deterministic replay', () => {
    let state = initialState('chess', options)
    for (const [index, notation] of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'].entries()) {
      const candidate = legalActions(state).find((item) => item.notation === notation)
      expect(candidate, notation).toBeDefined()
      const result = applyAction(state, {
        candidateId: candidate!.id,
        stateToken: candidate!.stateToken,
        actor: candidate!.actor,
        clientRequestId: `opening-${index}`,
      })
      expect(result.ok).toBe(true)
      if (result.ok) state = result.state
    }
    expect(legalActions(state).some((item) => item.notation === 'O-O')).toBe(true)
  })

  it('fails closed for a candidate attributed to the wrong actor', () => {
    const state = initialState('chess', options)
    const candidate = legalActions(state)[0]
    expect(applyAction(state, {
      candidateId: candidate.id,
      stateToken: candidate.stateToken,
      actor: 'second',
      clientRequestId: 'wrong-actor',
    })).toMatchObject({ ok: false, reason: 'wrong-actor' })
  })

  it.each(['chess', 'xiangqi', 'shogi'] as const)('replays a deterministic 24-ply %s path without mutation errors', (variant) => {
    let state = initialState(variant, { ...options, sessionId: `playout-${variant}` })
    for (let ply = 0; ply < 24 && state.status.phase === 'active'; ply += 1) {
      const candidates = legalActions(state)
      expect(candidates.length).toBeGreaterThan(0)
      const candidate = candidates[ply % candidates.length]
      const result = applyAction(state, {
        candidateId: candidate.id,
        stateToken: candidate.stateToken,
        actor: candidate.actor,
        clientRequestId: `${variant}-${ply}`,
      })
      expect(result.ok).toBe(true)
      if (!result.ok) break
      expect(result.state.revision).toBe(state.revision + 1)
      state = result.state
    }
    expect(state.moves.length).toBe(state.revision)
  })
})
