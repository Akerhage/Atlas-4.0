import { useState, useEffect } from 'react'
import { auth } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { useDataStore } from '../../hooks/useDataStore'
import { getAgentStyles, resolveLabel, smartTime } from '../../utils/styling'
import { AVATAR_ICONS, ADMIN_UI_ICONS } from '../../utils/constants'
import { showToast } from '../../components/ToastContainer'
import type { User, Ticket } from '../../types'

interface Props {
  username: string
  onEdit: (userData: unknown) => void
}

interface UserStats {
  active_tickets: number
  archived_tickets: number
  mail_handled: number
  internal_sent: number
}

export default function AdminUserDetail({ username, onEdit }: Props) {
  const { user: currentUser } = useAuth()
  const { officeData, usersCache, refreshUsers } = useDataStore()
  const [userData, setUserData] = useState<User | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [colorValue, setColorValue] = useState('')

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const [users, statsRes, ticketsRes] = await Promise.all([
          auth.getUsers(),
          fetch(`/api/admin/user-stats/${username}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }).then(r => r.json()),
          fetch(`/api/admin/agent-tickets/${username}`, {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
              'ngrok-skip-browser-warning': 'true',
            },
          }).then(r => r.json()),
        ])

        const found = users.find((u: User) => u.username === username)
        setUserData(found || null)
        setColorValue(found?.agent_color || '#0071e3')
        setStats(statsRes)
        setTickets(Array.isArray(ticketsRes) ? ticketsRes : [])
      } catch (err) {
        console.error('Failed to fetch user detail:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [username])

  const handleColorChange = async (newColor: string) => {
    setColorValue(newColor)
    try {
      await fetch('/api/admin/update-agent-color', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ username, color: newColor }),
      })
      // Update current user if self
      if (username === currentUser?.username) {
        document.documentElement.style.setProperty('--accent-primary', newColor)
        const stored = JSON.parse(localStorage.getItem('atlas_user') || '{}')
        stored.agent_color = newColor
        localStorage.setItem('atlas_user', JSON.stringify(stored))
      }
      refreshUsers()
    } catch (err) {
      console.error('Failed to update color:', err)
    }
  }

  const handleResetPassword = async () => {
    const password = window.prompt('Nytt lösenord (minst 6 tecken):')
    if (!password || password.length < 6) {
      showToast('Lösenordet måste vara minst 6 tecken.', 3000, 'error')
      return
    }
    try {
      await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ userId: userData?.id, password }),
      })
      showToast('Lösenordet har återställts.', 3000, 'success')
    } catch (err) {
      showToast('Kunde inte återställa lösenord.', 3000, 'error')
    }
  }

  const handleDeleteUser = async () => {
    if (!userData) return
    if (!window.confirm(`Är du säker på att du vill radera ${userData.display_name || userData.username}?`)) return
    try {
      await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ userId: userData.id }),
      })
      showToast('Agenten har raderats.', 3000, 'success')
      refreshUsers()
    } catch (err) {
      showToast('Kunde inte radera agent.', 3000, 'error')
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>
  if (!userData) return <div style={{ padding: 20 }}>Användaren hittades inte.</div>

  const styles = getAgentStyles(username, officeData, usersCache, currentUser)
  const displayName = userData.display_name || userData.username
  const avatarSvg = AVATAR_ICONS[userData.avatar_id ?? 0] || ''

  return (
    <div className="admin-detail-content" id="admin-detail-content" data-current-id={username}>
      {/* Header */}
      <div className="detail-header-top" style={{ borderBottom: `2px solid ${styles.main}` }}>
        <div className="detail-avatar" style={{ borderColor: styles.main }}>
          <div
            className="avatar-inner-icon"
            style={{ color: styles.main, fill: 'currentColor' }}
            dangerouslySetInnerHTML={{ __html: avatarSvg }}
          />
        </div>
        <div className="detail-header-info">
          <h3 className="detail-subject">{displayName.charAt(0).toUpperCase() + displayName.slice(1)}</h3>
          <div className="header-pills-row">
            <span className="pill" style={{ background: styles.tagBg, color: styles.main }}>
              {userData.role.toUpperCase()}
            </span>
            {userData.is_online && (
              <span className="pill" style={{ background: 'rgba(46, 204, 113, 0.2)', color: '#2ecc71' }}>
                ONLINE
              </span>
            )}
          </div>
        </div>
        <div className="detail-header-actions">
          <input
            type="color"
            value={colorValue}
            onChange={(e) => handleColorChange(e.target.value)}
            title="Agentfärg"
            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'transparent' }}
          />
          <button className="icon-only-btn" onClick={() => onEdit(userData)} title="Redigera">
            <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.EDIT }} />
          </button>
          <button className="icon-only-btn" onClick={handleResetPassword} title="Återställ lösenord">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
          <button className="icon-only-btn" onClick={handleDeleteUser} title="Radera agent" style={{ color: '#ff4444' }}>
            <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.DELETE }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '16px 20px' }}>
          <div className="admin-stat-cell">
            <div className="stat-value">{stats.active_tickets}</div>
            <div className="stat-label">Aktiva</div>
          </div>
          <div className="admin-stat-cell">
            <div className="stat-value">{stats.archived_tickets}</div>
            <div className="stat-label">Arkiverade</div>
          </div>
          <div className="admin-stat-cell">
            <div className="stat-value">{stats.mail_handled}</div>
            <div className="stat-label">Mail</div>
          </div>
          <div className="admin-stat-cell">
            <div className="stat-value">{stats.internal_sent}</div>
            <div className="stat-label">Interna</div>
          </div>
        </div>
      )}

      {/* Active Tickets */}
      <div style={{ padding: '0 20px 20px' }}>
        <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
          Aktiva ärenden ({tickets.length})
        </h4>
        <div className="scroll-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {tickets.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', fontSize: 13, padding: 12 }}>
              Inga aktiva ärenden.
            </div>
          )}
          {tickets.map(ticket => {
            const tStyles = getAgentStyles(ticket.routing_tag, officeData, usersCache, currentUser)
            return (
              <div
                key={ticket.conversation_id}
                className="admin-ticket-preview"
                style={{ borderLeft: `3px solid ${tStyles.main}`, padding: '10px 14px', marginBottom: 8 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="pill" style={{ background: tStyles.tagBg, color: tStyles.main, fontSize: 11 }}>
                    {resolveLabel(ticket.routing_tag, officeData)}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {smartTime(ticket.updated_at || ticket.created_at)}
                  </span>
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {ticket.customer_name || ticket.customer_email || 'Anonym'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
