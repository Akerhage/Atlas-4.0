import { useState, useEffect } from 'react'
import './Modal.css'
import { auth, team } from '../services/api'
import { useAuth } from '../context/AuthContext'
import { getAgentStyles } from '../utils/styling'
import { useDataStore } from '../hooks/useDataStore'
import { showToast } from './ToastContainer'
import { AVATAR_ICONS } from '../utils/constants'
import type { User } from '../types'

interface Props {
  conversationId: string
  onClose: () => void
  onAssigned: () => void
}

export default function AssignModal({ conversationId, onClose, onAssigned }: Props) {
  const { user: currentUser } = useAuth()
  const { officeData, usersCache } = useDataStore()
  const [agents, setAgents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const users = await auth.getUsers()
        setAgents(users
          .filter((u: User) => u.role !== 'admin' || u.username !== currentUser?.username)
          .sort((a: User, b: User) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'sv'))
        )
      } catch (err) {
        console.error('Failed to load agents:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAgents()
  }, [currentUser?.username])

  const handleAssign = async (targetAgent: string) => {
    try {
      await team.assignTicket(conversationId, targetAgent)
      showToast(`Ärende tilldelat ${targetAgent}`, 3000, 'success')
      onAssigned()
      onClose()
    } catch (err) {
      showToast('Kunde inte tilldela ärende.', 3000, 'error')
    }
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="glass-modal-header">
          <h3>Tilldela ärende</h3>
        </div>
        <div className="glass-modal-body" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {loading && <div className="loading-spinner">Laddar...</div>}
          {agents.map(agent => {
            const styles = getAgentStyles(agent.username, officeData, usersCache, currentUser)
            const avatarSvg = AVATAR_ICONS[agent.avatar_id ?? 0] || ''
            return (
              <div
                key={agent.username}
                className="admin-mini-card"
                onClick={() => handleAssign(agent.username)}
                style={{ cursor: 'pointer', borderLeft: `3px solid ${styles.main}`, marginBottom: 6 }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', border: `2px solid ${styles.main}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: styles.main, fill: 'currentColor', flexShrink: 0,
                }} dangerouslySetInnerHTML={{ __html: avatarSvg }} />
                <div className="admin-card-info">
                  <span className="admin-card-name">{agent.display_name || agent.username}</span>
                  <span style={{ fontSize: 11, color: agent.is_online ? '#2ecc71' : 'var(--text-tertiary)' }}>
                    {agent.is_online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <div className="glass-modal-footer">
          <button className="btn-modal-cancel" onClick={onClose}>Avbryt</button>
        </div>
      </div>
    </div>
  )
}
