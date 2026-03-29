import { useState, useCallback, useEffect, createContext, useContext } from 'react'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  exiting?: boolean
}

interface ToastAPI {
  showToast: (message: string, duration?: number, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastAPI>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

let globalShowToast: ToastAPI['showToast'] = () => {}

// Export for use outside React components (e.g., socket handlers)
export function showToast(message: string, duration = 5000, type: Toast['type'] = 'info') {
  globalShowToast(message, duration, type)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, duration = 5000, type: Toast['type'] = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { id, message, type }])

    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 280)
    }, duration)
  }, [])

  useEffect(() => {
    globalShowToast = addToast
    return () => { globalShowToast = () => {} }
  }, [addToast])

  return (
    <div id="atlas-toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast-notification toast-${toast.type}${toast.exiting ? ' toast-slide-out' : ''}`}
          dangerouslySetInnerHTML={{ __html: toast.message }}
        />
      ))}
    </div>
  )
}

export { ToastContext }
