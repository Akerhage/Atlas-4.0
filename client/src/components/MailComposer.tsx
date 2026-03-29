import { useState, useEffect } from 'react'
import './Modal.css'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { auth } from '../services/api'
import { showToast } from './ToastContainer'
import type { User } from '../types'

interface Props {
  onClose: () => void
  defaultRecipient?: string
  defaultSubject?: string
}

export default function MailComposer({ onClose, defaultRecipient, defaultSubject }: Props) {
  const { user } = useAuth()
  const { socket } = useSocket()
  const [mode, setMode] = useState<'external' | 'internal'>('external')
  const [recipient, setRecipient] = useState(defaultRecipient || '')
  const [subject, setSubject] = useState(defaultSubject || '')
  const [body, setBody] = useState('')
  const [agents, setAgents] = useState<User[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    auth.getUsers().then(users => {
      setAgents(users.filter((u: User) => u.username !== user?.username))
    }).catch(console.error)
  }, [user?.username])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSend = async () => {
    if (mode === 'external') {
      if (!recipient.trim() || !subject.trim() || !body.trim()) {
        showToast('Fyll i alla fält.', 3000, 'error')
        return
      }
    } else {
      if (!selectedAgent || !body.trim()) {
        showToast('Välj mottagare och skriv ett meddelande.', 3000, 'error')
        return
      }
    }

    setSending(true)
    try {
      if (mode === 'external') {
        // Create mail ticket via socket
        socket?.emit('team:create_mail_ticket', {
          to: recipient.trim(),
          subject: subject.trim(),
          body: body.trim(),
          agent: user?.username,
        })
        showToast('Mail skickat!', 2000, 'success')
      } else {
        // Create internal message
        await fetch('/team/create-internal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            target_agent: selectedAgent,
            message: body.trim(),
            sender: user?.username,
          }),
        })
        showToast('Internt meddelande skickat!', 2000, 'success')
      }
      onClose()
    } catch (err) {
      showToast('Kunde inte skicka.', 3000, 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh', overflow: 'auto' }}>
        <div className="glass-modal-header">
          <h3>Nytt meddelande</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="pill"
              onClick={() => setMode('external')}
              style={{
                cursor: 'pointer',
                background: mode === 'external' ? 'var(--accent-primary)' : 'var(--bg-dark-secondary)',
                color: mode === 'external' ? 'white' : 'var(--text-secondary)',
                border: 'none',
              }}
            >
              E-post
            </button>
            <button
              className="pill"
              onClick={() => setMode('internal')}
              style={{
                cursor: 'pointer',
                background: mode === 'internal' ? 'var(--accent-primary)' : 'var(--bg-dark-secondary)',
                color: mode === 'internal' ? 'white' : 'var(--text-secondary)',
                border: 'none',
              }}
            >
              Internt
            </button>
          </div>
        </div>

        <div className="glass-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {mode === 'external' ? (
            <>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mottagare</label>
                <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="email@example.com" />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ämne</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="Ämnesrad" />
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Mottagare</label>
              <select
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
                className="ln-input"
                style={{ width: '100%', marginTop: 4 }}
              >
                <option value="">Välj agent...</option>
                {agents.map(a => (
                  <option key={a.username} value={a.username}>
                    {a.display_name || a.username} {a.is_online ? '🟢' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Meddelande</label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              className="ln-input"
              style={{ width: '100%', marginTop: 4, minHeight: 150, resize: 'vertical', fontSize: 13 }}
              placeholder="Skriv ditt meddelande..."
            />
          </div>
        </div>

        <div className="glass-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-modal-cancel" onClick={onClose}>Avbryt</button>
          <button className="btn-modal-confirm" onClick={handleSend} disabled={sending}>
            {sending ? 'Skickar...' : 'Skicka'}
          </button>
        </div>
      </div>
    </div>
  )
}
