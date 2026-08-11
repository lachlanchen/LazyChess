import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { applyAction, legalActions } from './domain/adapter'
import {
  commitStore,
  createSession,
  loadStore,
  readStore,
  saveStore,
  STORAGE_KEY,
  type SessionStore,
} from './domain/persistence'
import type { GameState } from './domain/types'

function commitNotation(state: GameState, notation: string, requestId: string): GameState {
  const candidate = legalActions(state).find((item) => item.notation === notation)
  if (!candidate) throw new Error(`Missing candidate ${notation}`)
  const result = applyAction(state, {
    candidateId: candidate.id,
    stateToken: candidate.stateToken,
    actor: candidate.actor,
    clientRequestId: requestId,
  }, '2026-08-11T00:00:00.000Z')
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

function seedFoolsMatePreview(): void {
  const store = loadStore(localStorage, {
    sessionId: 'fools-mate-app',
    now: '2026-08-11T00:00:00.000Z',
  })
  let state = store.sessions[store.activeSessionId]
  state = commitNotation(state, 'f3', 'fools-mate-1')
  state = commitNotation(state, 'e5', 'fools-mate-2')
  state = commitNotation(state, 'g4', 'fools-mate-3')
  saveStore(localStorage, {
    ...store,
    sessions: { ...store.sessions, [store.activeSessionId]: state },
  })
}

describe('teaching interaction', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('opens a fresh game with a non-mutating first-move suggestion that can be dismissed', () => {
    render(<App />)
    const initial = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(initial.sessions[initial.activeSessionId].moves).toHaveLength(0)
    expect(screen.getByTestId('suggested-candidate')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('clear-position-map')).toBeInTheDocument()
    expect(document.querySelector('.board-stage')).toHaveAttribute('data-preview-source', 'suggested')
    expect(document.querySelector('.board-cell.is-preview-to')).toHaveAttribute('aria-pressed', 'false')
    for (const item of document.querySelectorAll<HTMLElement>('.candidate[data-rationale-contribution]')) {
      expect(Number(item.dataset.rationaleContribution)).toBeGreaterThan(0)
    }
    expect(screen.queryByRole('button', { name: /Confirm move/i })).not.toBeInTheDocument()

    fireEvent.contextMenu(document.querySelector('.board')!)
    expect(document.querySelector('.board-stage')).toHaveAttribute('data-preview-source', 'current')
    const dismissed = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(dismissed.sessions[dismissed.activeSessionId].moves).toHaveLength(0)
  })

  it('switches exact control, piece-safety, route, and king-zone board layers', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByTestId('position-map')).toHaveAttribute('data-mode', 'suggested')
    expect(screen.getByTestId('layer-control')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('legend-control')).toBeInTheDocument()
    expect(document.querySelector('[data-square][data-control-first]')).toBeInTheDocument()
    const occupiedCells = [...document.querySelectorAll<HTMLElement>('.board-cell .piece')]
      .map((piece) => piece.parentElement!)
    expect(occupiedCells).not.toHaveLength(0)
    for (const cell of occupiedCells) expect(cell.getAttribute('aria-label')).toMatch(/^(White|Black) /)
    const controlCell = document.querySelector<HTMLElement>('.board-cell[data-layer-description]')!
    expect(controlCell).toHaveAttribute('data-visual-layer', 'control')
    expect(controlCell.dataset.layerDescription).toMatch(/Control — White: \d+; Black: \d+\./)
    expect(controlCell.getAttribute('aria-label')).toContain(controlCell.dataset.layerDescription)

    await user.click(screen.getByTestId('layer-safety'))
    expect(screen.getByTestId('layer-safety')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('legend-safety')).toBeInTheDocument()
    expect(document.querySelector('.piece[class*="contact-"]')).toBeInTheDocument()
    const safetyCell = document.querySelector<HTMLElement>('.board-cell[data-piece-contact="defended-only"][data-layer-description]')!
    expect(safetyCell).toHaveAttribute('data-visual-layer', 'safety')
    expect(safetyCell).toHaveAttribute('data-layer-description', 'Defended piece')
    expect(safetyCell.getAttribute('aria-label')).toContain('Defended piece')

    await user.click(screen.getByTestId('layer-lanes'))
    expect(screen.getByTestId('layer-lanes')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('legend-lanes')).toBeInTheDocument()
    const laneCell = document.querySelector<HTMLElement>('.board-cell[data-layer-description]')!
    expect(laneCell).toHaveAttribute('data-visual-layer', 'lanes')
    expect(laneCell.dataset.layerDescription).toMatch(/Lines through this square/)
    expect(laneCell.getAttribute('aria-label')).toContain(laneCell.dataset.layerDescription)

    await user.click(screen.getByTestId('layer-king'))
    expect(screen.getByTestId('layer-king')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('legend-king')).toBeInTheDocument()
    expect(document.querySelector('.king-zone')).toBeInTheDocument()
    const kingCell = document.querySelector<HTMLElement>('.board-cell[data-king-zone][data-layer-description]')!
    expect(kingCell).toHaveAttribute('data-visual-layer', 'king')
    expect(kingCell.dataset.layerDescription).toMatch(/king zone/)
    expect(kingCell.getAttribute('aria-label')).toContain(kingCell.dataset.layerDescription)
  })

  it('previews Fool’s Mate as terminal without asking for an impossible reply', async () => {
    const user = userEvent.setup()
    seedFoolsMatePreview()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /^Black Queen · d8(?:\.|$)/ }))
    await user.click(screen.getByRole('button', { name: /^h4(?:\.|$)/ }))

    expect(screen.getByText('Checkmate: the game ends; no legal reply is available')).toBeInTheDocument()
    expect(screen.queryByText('Check: a legal royal reply is required')).not.toBeInTheDocument()
    expect(screen.queryByText('Force a king response')).not.toBeInTheDocument()
    expect(screen.getByText('Reply status · exact')).toBeInTheDocument()
    expect(screen.getByText('The deterministic rules mark the game complete. No opponent reply follows.')).toBeInTheDocument()
    expect(screen.queryByText('Before confirming: what can the opponent attack after this?')).not.toBeInTheDocument()
    const stored = readStore(localStorage)!
    expect(stored.sessions[stored.activeSessionId].moves).toHaveLength(3)
  })

  it('previews candidate-specific facts on hover and clears them with Escape', () => {
    render(<App />)
    const candidates = [...document.querySelectorAll<HTMLButtonElement>('.candidate[data-candidate-id]')]
    expect(candidates.length).toBeGreaterThan(1)
    fireEvent.mouseEnter(candidates[1])
    expect(document.querySelector('.board-stage')).toHaveAttribute('data-preview-source', 'hover')
    expect(screen.getByTestId('preview-summary')).toHaveAttribute('data-candidate-id', candidates[1].dataset.candidateId)
    expect(screen.getByTestId('analysis-provenance')).toBeInTheDocument()
    expect(document.querySelector('.threat-strip')).toBeInTheDocument()

    fireEvent.keyDown(candidates[1], { key: 'Escape' })
    expect(document.querySelector('.board-stage')).toHaveAttribute('data-preview-source', 'current')
  })

  it('uses a legal matched engine line as optional evidence without mutating the game', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as {
        stateToken: string
        variant: 'chess'
        actor: 'first'
        position: { board: Record<string, unknown>; hands: Record<string, unknown> }
      }
      expect(Object.keys(request.position.board)).toHaveLength(32)
      expect(request.position.hands).toEqual({ first: {}, second: {} })
      return {
        ok: true,
        json: async () => ({
          schemaVersion: 1,
          status: 'available',
          stateToken: request.stateToken,
          variant: request.variant,
          actor: request.actor,
          engine: {
            id: 'stockfish-18', name: 'Stockfish 18', version: '18', role: 'chess-specialist',
            sourceCommit: 'a'.repeat(40), binarySha256: 'b'.repeat(64), networkSha256: 'c'.repeat(64), limitation: 'specialist',
          },
          search: {
            perspective: 'root-side-to-move', rootActor: request.actor,
            limit: { movetimeMs: 1500, threads: 1, hashMb: 32, multiPv: 2 },
            completedDepth: 17, nodes: 1_500_000, timeMs: 1500,
          },
          lines: [
            { rank: 1, depth: 17, nodes: 900_000, timeMs: 1500, score: { kind: 'centipawn', value: 28, bound: 'exact' }, pv: ['e2e4', 'e7e5'] },
            { rank: 2, depth: 16, nodes: 600_000, timeMs: 1500, score: { kind: 'centipawn', value: 18, bound: 'exact' }, pv: ['d2d4', 'd7d5'] },
          ],
        }),
      } as Response
    }))
    render(<App />)
    await waitFor(() => expect(screen.getByTestId('engine-lane')).toHaveAttribute('data-status', 'available'))
    expect(screen.getByText('Stockfish 18')).toBeInTheDocument()
    expect(screen.getByText('Principal variation')).toBeInTheDocument()
    expect(screen.getByText('e2e4 e7e5')).toBeInTheDocument()
    expect(document.querySelector('.candidate[data-engine-rank="1"]')).toHaveAttribute('data-testid', 'suggested-candidate')
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(stored.sessions[stored.activeSessionId].moves).toHaveLength(0)
  })

  it('previews without mutation and commits only after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    const initial = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(initial.sessions[initial.activeSessionId].moves).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /^White Pawn · a2(?:\.|$)/ }))
    await user.click(screen.getByRole('button', { name: /^a3(?:\.|$)/ }))
    expect(screen.getAllByText(/board has not changed/i)).toHaveLength(2)
    const selectedCandidateId = screen.getByTestId('preview-summary').getAttribute('data-candidate-id')
    const anotherCandidate = [...document.querySelectorAll<HTMLButtonElement>('.candidate[data-candidate-id]')]
      .find((item) => item.dataset.candidateId !== selectedCandidateId)
    expect(anotherCandidate).toBeDefined()
    fireEvent.mouseEnter(anotherCandidate!)
    expect(screen.getByTestId('preview-summary')).toHaveAttribute('data-candidate-id', selectedCandidateId)
    const previewed = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(previewed.sessions[previewed.activeSessionId].moves).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /Confirm move/i }))
    const committed = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(committed.sessions[committed.activeSessionId].moves).toHaveLength(1)
  })

  it('switches all learner-facing primary copy to Simplified Chinese', () => {
    render(<App />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'zh-Hans' } })
    expect(screen.getByText('落子之前，先看懂它。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /确认走子/i })).not.toBeInTheDocument()
    expect(document.title).toBe('落子之前，先看懂它。')
  })

  it('restores only allowlisted locales and marks Arabic as RTL', () => {
    localStorage.setItem('three-boards.locale.v1', 'ar')
    const { unmount } = render(<App />)
    expect(screen.getByRole('combobox', { name: 'اللغة' })).toHaveValue('ar')
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.title).toBe('شاهد النقلة قبل تنفيذها.')
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute('content', expect.stringContaining('القواعد'))
    unmount()

    localStorage.setItem('three-boards.locale.v1', 'invalid-locale')
    render(<App />)
    expect(screen.getByRole('combobox', { name: 'Language' })).toHaveValue('en')
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.title).toBe('See the move before you make it.')
  })

  it('selects all three modes and resumes each without duplicate sessions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Xiangqi · Chinese Chess/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Xiangqi · Chinese Chess' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /International Chess/ }))
    await user.click(screen.getByRole('button', { name: /Xiangqi · Chinese Chess/ }))
    await user.click(screen.getByRole('button', { name: /Shogi · Japanese Chess/ }))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(stored.order).toHaveLength(3)
    expect(Object.values(stored.sessions).map((item) => item.variant).sort()).toEqual(['chess', 'shogi', 'xiangqi'])
  })

  it('reloads an externally committed tab revision from the storage event', async () => {
    render(<App />)
    const base = readStore(localStorage)!
    const proposed = createSession(base, 'shogi', 'external-tab', { sessionId: 'external-shogi' })
    expect(proposed).not.toBeNull()
    if (!proposed) return
    const committed = commitStore(localStorage, base, proposed, 'external-tab')
    expect(committed.ok).toBe(true)
    fireEvent(window, new StorageEvent('storage', { key: STORAGE_KEY }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Shogi · Japanese Chess' })).toBeInTheDocument()
    })
  })
})
