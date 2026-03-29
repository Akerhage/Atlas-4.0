import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Sidebar.css'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { AVATAR_ICONS } from '../utils/constants'
import { useDataStore } from '../hooks/useDataStore'
import ProfileModal from './ProfileModal'

interface NavItem {
  path: string
  view: string
  label: string
  icon: string
  adminOnly?: boolean
  badgeKey?: string
}

const NAV_ITEMS: NavItem[] = [
  {
    path: '/',
    view: 'chat',
    label: 'Hem',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  },
  {
    path: '/my-tickets',
    view: 'my-tickets',
    label: 'Mina ärenden',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    badgeKey: 'myTickets',
  },
  {
    path: '/inbox',
    view: 'inbox',
    label: 'Inkorgen',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    badgeKey: 'inbox',
    adminOnly: true,
  },
  {
    path: '/archive',
    view: 'archive',
    label: 'Garaget',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  },
  {
    path: '/customers',
    view: 'customers',
    label: 'Kunder',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  },
  {
    path: '/admin',
    view: 'admin',
    label: 'Admin',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    adminOnly: true,
  },
  {
    path: '/templates',
    view: 'templates',
    label: 'Mailmallar',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>',
  },
  {
    path: '/about',
    view: 'about',
    label: 'Om',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { isConnected } = useSocket()
  const { badges } = useDataStore()

  const [showProfile, setShowProfile] = useState(false)

  if (!user) return null

  const isAdmin = user.role === 'admin'
  const allowedViews: string[] | null = user.allowed_views
    ? JSON.parse(user.allowed_views)
    : null

  const isViewAllowed = (item: NavItem): boolean => {
    // Home is always visible
    if (item.view === 'chat') return true

    // Admin-only items
    if (item.adminOnly && !isAdmin) {
      if (item.view === 'admin') {
        const adminKeys = ['admin-users', 'admin-offices', 'admin-config']
        return !!allowedViews && adminKeys.some(k => allowedViews.includes(k))
      }
      return false
    }

    // allowed_views check
    if (allowedViews && !allowedViews.includes(item.view)) return false
    return true
  }

  const color = user.agent_color || '#0071e3'
  const displayName = user.display_name || user.username || 'Agent'
  const avatarSvg = AVATAR_ICONS[user.avatar_id ?? 0] || ''

  return (
    <>
    <nav className="sidebar glass-effect">
      <div className="sidebar-header">
        <img
          src="/assets/images/logo.png"
          alt="Atlas"
          className="sidebar-logo"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
        <span className="sidebar-app-name">ATLAS</span>
        <div className="server-status-wrapper">
          <span
            id="server-status"
            style={{ color: isConnected ? '#4cd137' : '#ff6b6b', fontSize: '11px' }}
          >
            {isConnected ? '🟢 LIVE' : '🔴 Frånkopplad'}
          </span>
        </div>
      </div>

      <ul className="sidebar-menu">
        {NAV_ITEMS.filter(isViewAllowed).map((item) => {
          const isActive = item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path)
          const badge = item.badgeKey ? badges[item.badgeKey] : 0

          return (
            <li
              key={item.view}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span
                className="menu-icon"
                dangerouslySetInnerHTML={{ __html: item.icon }}
              />
              <span className="menu-label">{item.label}</span>
              {badge > 0 && (
                <span className="notif-badge-bubble">{badge}</span>
              )}
            </li>
          )
        })}
      </ul>

      <div className="sidebar-footer">
        <div className="user-profile-container" id="user-profile-container" onClick={() => setShowProfile(true)} style={{ cursor: 'pointer' }}>
          <div
            className="user-avatar"
            style={{ borderColor: color }}
          >
            <div
              className="user-initial"
              style={{ backgroundColor: color }}
              dangerouslySetInnerHTML={{ __html: avatarSvg }}
            />
          </div>
          <div id="current-user-name">
            <span style={{ display: 'block', fontWeight: 600, color: 'white' }}>
              {displayName.charAt(0).toUpperCase() + displayName.slice(1)}
            </span>
            {user.status_text && (
              <span
                className="user-status-text"
                style={{
                  display: 'block',
                  fontSize: '10px',
                  color,
                  opacity: 0.85,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '120px',
                }}
                title={user.status_text}
              >
                {user.status_text}
              </span>
            )}
          </div>
          <button
            className="logout-btn"
            onClick={(e) => {
              e.stopPropagation()
              logout()
            }}
            title="Logga ut"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
    {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  )
}
