import { useState, useEffect } from 'react'
import { auth } from '../../services/api'
import { useDataStore } from '../../hooks/useDataStore'
import { getAgentStyles } from '../../utils/styling'
import { useAuth } from '../../context/AuthContext'
import { AVATAR_ICONS, ADMIN_UI_ICONS } from '../../utils/constants'
import type { User } from '../../types'

interface Props {
  selectedUser: string | null
  onSelectUser: (username: string) => void
  onNewUser: () => void
}

export default function AdminUserList({ selectedUser, onSelectUser, onNewUser }: Props) {
  const { user: currentUser } = useAuth()
  const { officeData, usersCache } = useDataStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await auth.getUsers()
        setUsers(data.sort((a, b) => (a.display_name || a.username).localeCompare(b.display_name || b.username, 'sv')))
      } catch (err) {
        console.error('Failed to fetch users:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchUsers()
  }, [])

  return (
    <div className="admin-main-list">
      <div className="admin-list-title">
        <span>Agenter ({users.length})</span>
        <button className="icon-only-btn" onClick={onNewUser} title="Ny agent">
          <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.NEW }} />
        </button>
      </div>
      <div className="admin-list-scroll">
        {loading && <div className="loading-spinner">Laddar...</div>}
        {users.map(u => {
          const styles = getAgentStyles(u.username, officeData, usersCache, currentUser)
          const isSelected = selectedUser === u.username
          const avatarSvg = AVATAR_ICONS[u.avatar_id ?? 0] || ''
          const displayName = u.display_name || u.username

          return (
            <div
              key={u.username}
              className={`admin-mini-card${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectUser(u.username)}
              style={{ borderLeft: `3px solid ${styles.main}` }}
            >
              <div className="admin-card-avatar" style={{ borderColor: styles.main }}>
                <div
                  className="avatar-inner-icon"
                  style={{ color: styles.main, fill: 'currentColor' }}
                  dangerouslySetInnerHTML={{ __html: avatarSvg }}
                />
                <span
                  className={`status-indicator${u.is_online ? ' online' : ''}`}
                  style={{ background: u.is_online ? '#2ecc71' : '#95a5a6' }}
                />
              </div>
              <div className="admin-card-info">
                <span className="admin-card-name">
                  {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
                </span>
                <span className="admin-card-role">{u.role}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
