import { useCallback, useState, type FormEvent } from 'react'

export const PREVIOUS_DATA_UNLOCK_PHRASE = 'previous data unlock'
export const PREVIOUS_DATA_UNLOCK_STORAGE = 'agent58_previous_data_unlock'

export function isPreviousDataUnlocked(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(PREVIOUS_DATA_UNLOCK_STORAGE) === '1'
}

export function usePreviousDataUnlock() {
  const [unlocked, setUnlocked] = useState(isPreviousDataUnlocked)
  const [unlockInput, setUnlockInput] = useState('')
  const [unlockMessage, setUnlockMessage] = useState<string | null>(null)

  const tryUnlock = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (unlockInput.trim().toLowerCase() === PREVIOUS_DATA_UNLOCK_PHRASE) {
        localStorage.setItem(PREVIOUS_DATA_UNLOCK_STORAGE, '1')
        setUnlocked(true)
        setUnlockInput('')
        setUnlockMessage('Previous data unlocked — all departments restored.')
        return true
      }
      setUnlockMessage('Wrong key. Use exactly: previous data unlock')
      return false
    },
    [unlockInput],
  )

  const lockAgain = useCallback(() => {
    localStorage.removeItem(PREVIOUS_DATA_UNLOCK_STORAGE)
    setUnlocked(false)
    setUnlockMessage('Locked again — CSE-only mode.')
  }, [])

  return {
    unlocked,
    unlockInput,
    setUnlockInput,
    unlockMessage,
    setUnlockMessage,
    tryUnlock,
    lockAgain,
  }
}

/** Compact secondary unlock control — keeps CSE-only default without dominating the page. */
export function PreviousDataUnlockPanel({
  unlocked,
  unlockInput,
  setUnlockInput,
  onUnlock,
  onLock,
}: {
  unlocked: boolean
  unlockInput: string
  setUnlockInput: (v: string) => void
  onUnlock: (e: FormEvent) => void
  onLock: () => void
}) {
  const [open, setOpen] = useState(false)

  if (unlocked) {
    return (
      <div className="unlock-compact unlock-compact--open">
        <span className="meta-chip meta-chip-ok">Multi-dept unlocked</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onLock}>
          Lock to CSE
        </button>
      </div>
    )
  }

  return (
    <div className="unlock-compact">
      {!open ? (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => setOpen(true)}
          title="Restore previous multi-department data"
        >
          <i className="fa-solid fa-unlock-keyhole" aria-hidden /> Unlock previous data
        </button>
      ) : (
        <form className="unlock-compact-form" onSubmit={onUnlock}>
          <input
            className="dash-input"
            type="password"
            value={unlockInput}
            onChange={(e) => setUnlockInput(e.target.value)}
            placeholder="Unlock key…"
            autoComplete="off"
            aria-label="Previous data unlock key"
          />
          <button type="submit" className="btn btn-primary btn-sm">
            Unlock
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      )}
    </div>
  )
}
