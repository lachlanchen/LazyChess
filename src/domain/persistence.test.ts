import { describe, expect, it } from 'vitest'
import {
  commitStore,
  createSession,
  loadStore,
  readStore,
  saveStore,
  STORAGE_KEY,
  updateSession,
  type StorageLike,
} from './persistence'

function memoryStorage(): StorageLike & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('session persistence', () => {
  it('resumes the same initial session instead of duplicating it', () => {
    const storage = memoryStorage()
    const first = loadStore(storage, { sessionId: 'only', now: '2026-08-11T00:00:00.000Z' })
    const second = loadStore(storage)
    expect(second.activeSessionId).toBe('only')
    expect(second.order).toEqual(first.order)
  })

  it('adopts a valid session published during bootstrap instead of overwriting it', () => {
    const externalStorage = memoryStorage()
    const external = loadStore(externalStorage, { sessionId: 'published-first' })
    const storage = memoryStorage()
    const originalGet = storage.getItem
    let primaryReads = 0
    storage.getItem = (key) => {
      if (key === STORAGE_KEY) {
        primaryReads += 1
        if (primaryReads === 2) storage.values.set(key, JSON.stringify(external))
      }
      return originalGet(key)
    }

    const loaded = loadStore(storage, { sessionId: 'would-have-lost' })
    expect(loaded.activeSessionId).toBe('published-first')
    expect(readStore(storage)?.sessions['would-have-lost']).toBeUndefined()
  })

  it('deduplicates new-session requests', () => {
    const storage = memoryStorage()
    const initial = loadStore(storage, { sessionId: 'one' })
    const created = createSession(initial, 'shogi', 'new-1', { sessionId: 'two' })
    expect(created).not.toBeNull()
    if (!created) return
    const replayed = createSession(created, 'shogi', 'new-1', { sessionId: 'three' })
    expect(replayed).not.toBeNull()
    if (!replayed) return
    expect(replayed.order).toEqual(['two', 'one'])
    expect(replayed.activeSessionId).toBe('two')
    saveStore(storage, replayed)
    expect(loadStore(storage).order).toEqual(['two', 'one'])
  })

  it('binds a new-session request ID to its original variant', () => {
    const storage = memoryStorage()
    const initial = loadStore(storage, { sessionId: 'one' })
    const created = createSession(initial, 'shogi', 'bound-new', { sessionId: 'two' })
    expect(created).not.toBeNull()
    if (!created) return
    const conflict = createSession(created, 'xiangqi', 'bound-new', { sessionId: 'three' })
    expect(conflict).toBeNull()
    expect(created.sessions.three).toBeUndefined()
  })

  it('fails a stale persistence revision', () => {
    const storage = memoryStorage()
    const store = loadStore(storage, { sessionId: 'one' })
    const state = { ...store.sessions.one, revision: 1 }
    expect(updateSession(store, 3, state)).toBeNull()
    expect(updateSession(store, 0, state)?.sessions.one.revision).toBe(1)
  })

  it('fails closed from malformed saved state', () => {
    const storage = memoryStorage()
    storage.setItem('three-boards.sessions.v1', JSON.stringify({
      schemaVersion: 1,
      activeSessionId: 'broken',
      sessions: { broken: { schemaVersion: 1, sessionId: 'broken', variant: 'chess' } },
      order: ['broken'],
    }))
    const recovered = loadStore(storage, { sessionId: 'recovered' })
    expect(recovered.order).toEqual(['recovered'])
  })

  it('migrates a structurally valid v1 lesson while discarding unbound request IDs', () => {
    const sourceStorage = memoryStorage()
    const source = loadStore(sourceStorage, { sessionId: 'legacy', now: '2026-08-11T00:00:00.000Z' })
    const legacyState = {
      ...source.sessions.legacy,
      schemaVersion: 1,
      appliedRequestIds: ['cannot-be-safely-replayed'],
    }
    const targetStorage = memoryStorage()
    targetStorage.setItem('three-boards.sessions.v1', JSON.stringify({
      schemaVersion: 1,
      activeSessionId: 'legacy',
      sessions: { legacy: legacyState },
      order: ['legacy'],
      newRequestIds: {},
    }))
    const migrated = loadStore(targetStorage)
    expect(migrated.schemaVersion).toBe(2)
    expect(migrated.sessions.legacy.schemaVersion).toBe(2)
    expect(migrated.sessions.legacy.appliedRequests).toEqual({})
    expect(readStore(targetStorage)?.activeSessionId).toBe('legacy')
  })

  it('rejects a stale repository instance instead of overwriting a newer tab', () => {
    const storage = memoryStorage()
    const base = loadStore(storage, { sessionId: 'base' })
    const tabA = structuredClone(base)
    const tabB = structuredClone(base)
    const proposalA = createSession(tabA, 'xiangqi', 'tab-a', { sessionId: 'session-a' })!
    const proposalB = createSession(tabB, 'shogi', 'tab-b', { sessionId: 'session-b' })!

    const committedA = commitStore(storage, tabA, proposalA, 'tab-a')
    expect(committedA.ok).toBe(true)
    const committedB = commitStore(storage, tabB, proposalB, 'tab-b')
    expect(committedB).toMatchObject({ ok: false, reason: 'stale-store' })
    expect(readStore(storage)?.sessions['session-a']).toBeDefined()
    expect(readStore(storage)?.sessions['session-b']).toBeUndefined()
  })

  it('detects an overwrite injected between write and verification', () => {
    const storage = memoryStorage()
    const base = loadStore(storage, { sessionId: 'base' })
    const contenderStorage = memoryStorage()
    saveStore(contenderStorage, structuredClone(base))
    const contenderProposal = createSession(base, 'xiangqi', 'contender', { sessionId: 'winner' })!
    const contender = commitStore(contenderStorage, base, contenderProposal, 'contender')
    expect(contender.ok).toBe(true)
    if (!contender.ok) return

    const attemptedProposal = createSession(base, 'shogi', 'attempted', { sessionId: 'loser' })!
    const underlyingSet = storage.setItem
    storage.setItem = (key, value) => {
      underlyingSet(key, value)
      if (key === STORAGE_KEY) underlyingSet(key, JSON.stringify(contender.store))
    }
    const attempted = commitStore(storage, base, attemptedProposal, 'attempted')
    expect(attempted).toMatchObject({ ok: false, reason: 'write-race' })
    expect(readStore(storage)?.activeSessionId).toBe('winner')
  })

  it('replays a store mutation ID only for the same proposed payload', () => {
    const storage = memoryStorage()
    const base = loadStore(storage, { sessionId: 'base' })
    const proposal = createSession(base, 'xiangqi', 'mutation-1', { sessionId: 'xq' })!
    const first = commitStore(storage, base, proposal, 'mutation-1')
    expect(first.ok).toBe(true)
    expect(commitStore(storage, base, proposal, 'mutation-1')).toMatchObject({ ok: true, replayed: true })
    const different = createSession(base, 'shogi', 'different', { sessionId: 'shogi' })!
    expect(commitStore(storage, base, different, 'mutation-1')).toMatchObject({
      ok: false,
      reason: 'idempotency-conflict',
    })
  })
})
