import { useState, useCallback, useEffect, createContext, useContext } from 'react'
import './Modal.css'

interface ConfirmOptions {
  title: string
  message: string
}

interface PromptOptions {
  title: string
  message: string
  defaultValue?: string
}

interface ModalAPI {
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  prompt: (opts: PromptOptions) => Promise<string | null>
}

const ModalContext = createContext<ModalAPI>({
  confirm: () => Promise.resolve(false),
  prompt: () => Promise.resolve(null),
})

export function useModal() {
  return useContext(ModalContext)
}

interface ModalState {
  type: 'confirm' | 'prompt' | null
  title: string
  message: string
  defaultValue: string
  resolve: ((value: boolean | string | null) => void) | null
}

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState>({
    type: null, title: '', message: '', defaultValue: '', resolve: null,
  })
  const [inputValue, setInputValue] = useState('')

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setState({ type: 'confirm', title: opts.title, message: opts.message, defaultValue: '', resolve: resolve as (v: boolean | string | null) => void })
    })
  }, [])

  const prompt = useCallback((opts: PromptOptions): Promise<string | null> => {
    return new Promise(resolve => {
      setState({ type: 'prompt', title: opts.title, message: opts.message, defaultValue: opts.defaultValue || '', resolve: resolve as (v: boolean | string | null) => void })
      setInputValue(opts.defaultValue || '')
    })
  }, [])

  const close = (result: boolean | string | null) => {
    state.resolve?.(result)
    setState({ type: null, title: '', message: '', defaultValue: '', resolve: null })
  }

  // ESC to cancel
  useEffect(() => {
    if (!state.type) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(state.type === 'confirm' ? false : null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [state.type])

  return (
    <ModalContext.Provider value={{ confirm, prompt }}>
      {children}
      {state.type && (
        <div className="modal-overlay" onClick={() => close(state.type === 'confirm' ? false : null)}>
          <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="glass-modal-header">
              <h3>{state.title}</h3>
            </div>
            <div className="glass-modal-body">
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px' }}>{state.message}</p>
              {state.type === 'prompt' && (
                <input
                  type="text"
                  className="ln-input"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') close(inputValue) }}
                  autoFocus
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className="glass-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                className="btn-modal-cancel"
                onClick={() => close(state.type === 'confirm' ? false : null)}
              >
                Avbryt
              </button>
              <button
                className="btn-modal-confirm"
                onClick={() => close(state.type === 'confirm' ? true : inputValue)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  )
}
