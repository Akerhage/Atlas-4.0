import { useState, useEffect, useRef, useCallback } from 'react'

interface NotifItem {
  id: string
  html: string
  timestamp: number
}

interface HistoryItem {
  icon: string
  text: string
  conversationId?: string
  timestamp: number
}

const STORAGE_KEY_NOTIFS = 'atlas_notifs'
const STORAGE_KEY_HISTORY = 'atlas_history'
const STORAGE_KEY_SEEN = 'atlas_notif_seen'
const MAX_ITEMS = 50

function loadFromStorage<T>(key: string): T[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]')
  } catch {
    return []
  }
}

function saveToStorage<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_ITEMS)))
}

function stripHtmlLocal(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const text = tmp.textContent || tmp.innerText || ''
  return text.length > 90 ? text.substring(0, 90) + '...' : text
}

function timeLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  const t = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? t : d.toLocaleDateString('sv-SE') + ' ' + t
}

// Global function for adding notifications from outside React
let _addNotifGlobal: ((html: string) => void) | null = null
let _addHistoryGlobal: ((icon: string, text: string, conversationId?: string) => void) | null = null

export function addNotification(html: string) {
  _addNotifGlobal?.(html)
}

export function addHistory(icon: string, text: string, conversationId?: string) {
  _addHistoryGlobal?.(icon, text, conversationId)
}

export default function NotifBell() {
  const [notifs, setNotifs] = useState<NotifItem[]>(() => loadFromStorage(STORAGE_KEY_NOTIFS))
  const [history, setHistory] = useState<HistoryItem[]>(() => loadFromStorage(STORAGE_KEY_HISTORY))
  const [lastSeen, setLastSeen] = useState<number>(() => Number(localStorage.getItem(STORAGE_KEY_SEEN) || '0'))
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'notifs' | 'history'>('notifs')
  const panelRef = useRef<HTMLDivElement>(null)

  const unseenCount = notifs.filter(n => n.timestamp > lastSeen).length

  const addNotif = useCallback((html: string) => {
    const item: NotifItem = { id: Date.now().toString(), html: stripHtmlLocal(html), timestamp: Date.now() }
    setNotifs(prev => {
      const next = [item, ...prev].slice(0, MAX_ITEMS)
      saveToStorage(STORAGE_KEY_NOTIFS, next)
      return next
    })
  }, [])

  const addHistoryItem = useCallback((icon: string, text: string, conversationId?: string) => {
    const item: HistoryItem = { icon, text, conversationId, timestamp: Date.now() }
    setHistory(prev => {
      const next = [item, ...prev].slice(0, MAX_ITEMS)
      saveToStorage(STORAGE_KEY_HISTORY, next)
      return next
    })
  }, [])

  // Register globals
  useEffect(() => {
    _addNotifGlobal = addNotif
    _addHistoryGlobal = addHistoryItem
    return () => { _addNotifGlobal = null; _addHistoryGlobal = null }
  }, [addNotif, addHistoryItem])

  const togglePanel = () => {
    if (!isOpen) {
      const now = Date.now()
      setLastSeen(now)
      localStorage.setItem(STORAGE_KEY_SEEN, String(now))
    }
    setIsOpen(prev => !prev)
  }

  const clearAll = () => {
    setNotifs([])
    setHistory([])
    localStorage.removeItem(STORAGE_KEY_NOTIFS)
    localStorage.removeItem(STORAGE_KEY_HISTORY)
  }

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button className="notif-bell-btn" onClick={togglePanel} title="Notifikationer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unseenCount > 0 && (
          <span className="notif-badge-bubble" style={{ position: 'absolute', top: -4, right: -4, fontSize: 10, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unseenCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notif-panel"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            maxHeight: 400,
            background: 'var(--bg-dark-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            zIndex: 9999,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className={`notif-tab${activeTab === 'notifs' ? ' active' : ''}`}
                onClick={() => setActiveTab('notifs')}
                style={{ fontSize: 12, background: activeTab === 'notifs' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'notifs' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                Notiser
              </button>
              <button
                className={`notif-tab${activeTab === 'history' ? ' active' : ''}`}
                onClick={() => setActiveTab('history')}
                style={{ fontSize: 12, background: activeTab === 'history' ? 'var(--accent-primary)' : 'transparent', color: activeTab === 'history' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '4px 10px', borderRadius: 6, cursor: 'pointer' }}
              >
                Historik
              </button>
            </div>
            <button onClick={clearAll} style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Rensa
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
            {activeTab === 'notifs' && (
              notifs.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24, fontSize: 12 }}>Inga notiser.</div>
              ) : (
                notifs.map(n => (
                  <div key={n.id} className="notif-item" style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}>
                    <div>{n.html}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{timeLabel(n.timestamp)}</div>
                  </div>
                ))
              )
            )}
            {activeTab === 'history' && (
              history.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24, fontSize: 12 }}>Ingen historik.</div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="notif-item" style={{ padding: '8px 14px', fontSize: 12, display: 'flex', gap: 8, alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)' }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{h.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--text-primary)' }}>{h.text}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{timeLabel(h.timestamp)}</div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
