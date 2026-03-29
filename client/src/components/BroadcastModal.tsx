import { useState, useEffect } from 'react'
import './Modal.css'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useDataStore } from '../hooks/useDataStore'
import { getAgentStyles } from '../utils/styling'
import { showToast } from './ToastContainer'
import { addHistory } from './NotifBell'
import type { User } from '../types'

interface Props {
  mode: 'agent' | 'office'
  target: string // username or routing_tag
  displayName: string
  onClose: () => void
}

export default function BroadcastModal({ mode, target, displayName, onClose }: Props) {
  const { user: currentUser } = useAuth()
  const { socket } = useSocket()
  const { officeData, usersCache } = useDataStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const agentColor = currentUser?.agent_color || '#0071e3'

  // Get recipients
  const recipients: User[] = mode === 'agent'
    ? usersCache.filter(u => u.username === target)
    : usersCache.filter(u => {
        // Filter agents by office routing tag
        return u.role === 'agent' || u.role === 'admin'
      })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = () => {
    if (!message.trim() || !socket) return
    setSending(true)

    if (mode === 'agent') {
      socket.emit('agent:broadcast', { username: target, message: message.trim() })
    } else {
      socket.emit('office:broadcast', { office_tag: target, message: message.trim() })
    }

    addHistory('📢', `Meddelande skickat till ${displayName}`)
    showToast(`Meddelande skickat till ${displayName}`, 3000, 'success')
    setSending(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
        {/* Header */}
        <div
          className="glass-modal-header"
          style={{ background: `linear-gradient(135deg, ${agentColor}15, transparent)`, borderBottom: `2px solid ${agentColor}` }}
        >
          <h3>Skicka meddelande</h3>
        </div>

        <div className="glass-modal-body">
          {/* Recipients */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, display: 'block' }}>
              {mode === 'agent' ? 'Mottagare' : `Agenter på ${displayName}`}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {recipients.slice(0, 10).map(agent => {
                const aStyles = getAgentStyles(agent.username, officeData, usersCache, currentUser)
                return (
                  <div
                    key={agent.username}
                    className="pill"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: aStyles.bg, color: aStyles.main, border: `1px solid ${aStyles.border}` }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: agent.is_online ? '#2ecc71' : '#95a5a6',
                    }} />
                    {agent.display_name || agent.username}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Message input */}
          <textarea
            className="ln-input"
            placeholder="Skriv ditt meddelande..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSend() }}
            rows={4}
            style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
            autoFocus
          />
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
            Ctrl+Enter för att skicka
          </div>
        </div>

        <div className="glass-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-modal-cancel" onClick={onClose}>Avbryt</button>
          <button className="btn-modal-confirm" onClick={handleSend} disabled={!message.trim() || sending}>
            {sending ? 'Skickar...' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  )
}
