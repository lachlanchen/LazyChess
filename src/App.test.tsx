import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { commitStore, createSession, readStore, STORAGE_KEY, type SessionStore } from './domain/persistence'

describe('teaching interaction', () => {
  beforeEach(() => localStorage.clear())

  it('previews without mutation and commits only after confirmation', async () => {
    const user = userEvent.setup()
    render(<App />)
    const initial = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(initial.sessions[initial.activeSessionId].moves).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Pawn · a2' }))
    await user.click(screen.getByRole('button', { name: 'a3' }))
    expect(screen.getAllByText(/board has not changed/i)).toHaveLength(2)
    const previewed = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(previewed.sessions[previewed.activeSessionId].moves).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: /Confirm move/i }))
    const committed = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as SessionStore
    expect(committed.sessions[committed.activeSessionId].moves).toHaveLength(1)
  })

  it('switches all learner-facing primary copy to Simplified Chinese', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '中文' }))
    expect(screen.getByText('落子之前，先看懂它。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /确认走子/i })).not.toBeInTheDocument()
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
