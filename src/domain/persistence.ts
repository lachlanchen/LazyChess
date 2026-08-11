import { initialState } from './adapter'
import { digest } from './hash'
import type { GameState, Variant } from './types'

export const STORAGE_KEY = 'three-boards.sessions.v2'
const LEGACY_STORAGE_KEY = 'three-boards.sessions.v1'

export interface NewSessionRequest {
  fingerprint: string
  sessionId: string
}

export interface SessionStore {
  schemaVersion: 2
  storeRevision: number
  lastMutationId: string
  lastMutationFingerprint: string
  activeSessionId: string
  sessions: Record<string, GameState>
  order: string[]
  newRequests: Record<string, NewSessionRequest>
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export type StoreCommitResult =
  | { ok: true; store: SessionStore; replayed: boolean }
  | {
      ok: false
      current: SessionStore | null
      reason: 'missing-store' | 'stale-store' | 'write-race' | 'write-failed' | 'idempotency-conflict'
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validState(value: unknown): value is GameState {
  if (!isRecord(value)) return false
  const state = value as Partial<GameState>
  return state.schemaVersion === 2
    && typeof state.sessionId === 'string'
    && ['chess', 'xiangqi', 'shogi'].includes(state.variant ?? '')
    && (state.actor === 'first' || state.actor === 'second')
    && typeof state.ruleset === 'string'
    && isRecord(state.board)
    && isRecord(state.hands)
    && Number.isInteger(state.ply) && Number.isInteger(state.revision)
    && Array.isArray(state.moves) && isRecord(state.appliedRequests)
    && isRecord(state.status)
    && typeof state.createdAt === 'string' && typeof state.updatedAt === 'string'
}

function validNewRequests(value: unknown): value is Record<string, NewSessionRequest> {
  return isRecord(value) && Object.values(value).every((item) =>
    isRecord(item) && typeof item.fingerprint === 'string' && typeof item.sessionId === 'string',
  )
}

function parseStore(raw: string | null): SessionStore | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<SessionStore>
    if (parsed.schemaVersion !== 2
      || !Number.isInteger(parsed.storeRevision)
      || typeof parsed.lastMutationId !== 'string'
      || typeof parsed.lastMutationFingerprint !== 'string'
      || typeof parsed.activeSessionId !== 'string'
      || !isRecord(parsed.sessions)
      || !Array.isArray(parsed.order)
      || !validNewRequests(parsed.newRequests)) return null
    const sessions = Object.fromEntries(
      Object.entries(parsed.sessions).filter(([id, state]) => validState(state) && state.sessionId === id),
    )
    const order = parsed.order.filter((id): id is string => typeof id === 'string' && Boolean(sessions[id]))
    if (!sessions[parsed.activeSessionId] || order.length === 0) return null
    return {
      schemaVersion: 2,
      storeRevision: parsed.storeRevision as number,
      lastMutationId: parsed.lastMutationId,
      lastMutationFingerprint: parsed.lastMutationFingerprint,
      activeSessionId: parsed.activeSessionId,
      sessions,
      order,
      newRequests: parsed.newRequests,
    }
  } catch {
    return null
  }
}

function migrateLegacyStore(raw: string | null): SessionStore | null {
  if (!raw) return null
  try {
    const legacy = JSON.parse(raw) as Record<string, unknown>
    if (legacy.schemaVersion !== 1 || !isRecord(legacy.sessions) || !Array.isArray(legacy.order)) return null
    const sessions: Record<string, GameState> = {}
    for (const [id, value] of Object.entries(legacy.sessions)) {
      if (!isRecord(value)
        || value.schemaVersion !== 1
        || value.sessionId !== id
        || !['chess', 'xiangqi', 'shogi'].includes(String(value.variant))
        || !isRecord(value.board)
        || !isRecord(value.hands)
        || !Array.isArray(value.moves)) continue
      const migrated: Record<string, unknown> = {
        ...value,
        schemaVersion: 2,
        appliedRequests: {},
      }
      delete migrated.appliedRequestIds
      if (validState(migrated)) sessions[id] = migrated
    }
    const order = legacy.order.filter((id): id is string => typeof id === 'string' && Boolean(sessions[id]))
    const requestedActive = typeof legacy.activeSessionId === 'string' ? legacy.activeSessionId : ''
    const activeSessionId = sessions[requestedActive] ? requestedActive : order[0]
    if (!activeSessionId) return null
    const base = { activeSessionId, sessions, order, newRequests: {} }
    return {
      schemaVersion: 2,
      storeRevision: 0,
      lastMutationId: 'migration-v1',
      lastMutationFingerprint: digest(base),
      ...base,
    }
  } catch {
    return null
  }
}

export function readStore(storage: StorageLike): SessionStore | null {
  return parseStore(storage.getItem(STORAGE_KEY))
}

function freshStore(options: { sessionId?: string; now?: string }): SessionStore {
  const state = initialState('chess', options)
  const base = {
    activeSessionId: state.sessionId,
    sessions: { [state.sessionId]: state },
    order: [state.sessionId],
    newRequests: {},
  }
  return {
    schemaVersion: 2,
    storeRevision: 0,
    lastMutationId: `bootstrap:${state.sessionId}`,
    lastMutationFingerprint: digest(base),
    ...base,
  }
}

/** Bootstrap/migration writer only. User mutations must use commitStore. */
export function saveStore(storage: StorageLike, store: SessionStore): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function loadStore(storage: StorageLike, options: { sessionId?: string; now?: string } = {}): SessionStore {
  const current = readStore(storage)
  if (current) return current
  const candidate = migrateLegacyStore(storage.getItem(LEGACY_STORAGE_KEY)) ?? freshStore(options)

  // Double-read initialization: prefer any valid store published after our first read.
  const beforeWrite = readStore(storage)
  if (beforeWrite) return beforeWrite
  saveStore(storage, candidate)
  return readStore(storage) ?? candidate
}

export function storeFingerprint(store: SessionStore): string {
  return digest(store)
}

function mutationFingerprint(expectedRevision: number, proposed: SessionStore): string {
  return digest({
    expectedRevision,
    activeSessionId: proposed.activeSessionId,
    sessions: proposed.sessions,
    order: proposed.order,
    newRequests: proposed.newRequests,
  })
}

/**
 * Best-effort localStorage compare-and-swap. It detects stale readers before
 * writing and an overwrite observable immediately after writing. localStorage
 * has no atomic CAS primitive, so callers must also listen for `storage` events;
 * a server transaction or Web Locks are required for a strict cross-tab proof.
 */
export function commitStore(
  storage: StorageLike,
  expected: SessionStore,
  proposed: SessionStore,
  mutationId: string,
): StoreCommitResult {
  const fingerprint = mutationFingerprint(expected.storeRevision, proposed)
  const current = readStore(storage)
  if (!current) return { ok: false, current: null, reason: 'missing-store' }
  if (current.lastMutationId === mutationId) {
    return current.lastMutationFingerprint === fingerprint
      ? { ok: true, store: current, replayed: true }
      : { ok: false, current, reason: 'idempotency-conflict' }
  }
  if (current.storeRevision !== expected.storeRevision || storeFingerprint(current) !== storeFingerprint(expected)) {
    return { ok: false, current, reason: 'stale-store' }
  }
  const next: SessionStore = {
    ...proposed,
    schemaVersion: 2,
    storeRevision: current.storeRevision + 1,
    lastMutationId: mutationId,
    lastMutationFingerprint: fingerprint,
  }
  const serialized = JSON.stringify(next)
  try {
    storage.setItem(STORAGE_KEY, serialized)
  } catch {
    return { ok: false, current: readStore(storage), reason: 'write-failed' }
  }
  const confirmedRaw = storage.getItem(STORAGE_KEY)
  if (confirmedRaw !== serialized) {
    return { ok: false, current: parseStore(confirmedRaw), reason: 'write-race' }
  }
  return { ok: true, store: next, replayed: false }
}

export function createSession(
  store: SessionStore,
  variant: Variant,
  clientRequestId: string,
  options: { sessionId?: string; now?: string } = {},
): SessionStore | null {
  const fingerprint = digest({ operation: 'create-session', variant })
  const previous = store.newRequests[clientRequestId]
  if (previous) {
    if (previous.fingerprint !== fingerprint) return null
    return store.sessions[previous.sessionId] ? { ...store, activeSessionId: previous.sessionId } : store
  }
  const state = initialState(variant, options)
  return {
    ...store,
    activeSessionId: state.sessionId,
    sessions: { ...store.sessions, [state.sessionId]: state },
    order: [state.sessionId, ...store.order],
    newRequests: {
      ...store.newRequests,
      [clientRequestId]: { fingerprint, sessionId: state.sessionId },
    },
  }
}

export function updateSession(store: SessionStore, expectedRevision: number, state: GameState): SessionStore | null {
  const current = store.sessions[state.sessionId]
  if (!current || current.revision !== expectedRevision) return null
  return { ...store, sessions: { ...store.sessions, [state.sessionId]: state } }
}

export function selectSession(store: SessionStore, sessionId: string): SessionStore {
  return store.sessions[sessionId] ? { ...store, activeSessionId: sessionId } : store
}
