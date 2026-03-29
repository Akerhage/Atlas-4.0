import { useState, useCallback } from 'react'
import './Admin.css'
import { useAuth } from '../../context/AuthContext'
import AdminUserList from './AdminUserList'
import AdminUserDetail from './AdminUserDetail'
import AdminUserForm from './AdminUserForm'
import AdminOfficeList from './AdminOfficeList'
import AdminOfficeDetail from './AdminOfficeDetail'
import AdminOfficeForm from './AdminOfficeForm'
import AdminConfigNav from './AdminConfigNav'
import AdminConfigDetail from './AdminConfigDetail'
type AdminTab = 'users' | 'offices' | 'config'

export default function Admin() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null)
  const [selectedConfigSection, setSelectedConfigSection] = useState<string | null>(null)
  const [editingUser, setEditingUser] = useState<unknown | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [creatingOffice, setCreatingOffice] = useState(false)
  const [formDirty, setFormDirty] = useState(false)

  const guardNavigation = useCallback((cb: () => void) => {
    if (formDirty) {
      if (window.confirm('Du har osparade ändringar. Vill du lämna utan att spara?')) {
        setFormDirty(false)
        cb()
      }
    } else {
      cb()
    }
  }, [formDirty])

  const switchTab = useCallback((tab: AdminTab) => {
    guardNavigation(() => {
      setActiveTab(tab)
      setSelectedUser(null)
      setSelectedOffice(null)
      setSelectedConfigSection(null)
      setCreatingUser(false)
      setCreatingOffice(false)
      setEditingUser(null)
    })
  }, [guardNavigation])

  if (!user || (user.role !== 'admin')) {
    const allowedViews: string[] | null = user?.allowed_views ? JSON.parse(user.allowed_views) : null
    const adminKeys = ['admin-users', 'admin-offices', 'admin-config']
    const hasAccess = allowedViews && adminKeys.some(k => allowedViews.includes(k))
    if (!hasAccess) {
      return (
        <div className="hero-placeholder">
          <div className="hero-content">
            <div className="hero-title">Åtkomst nekad</div>
            <div className="hero-subtitle">Du har inte behörighet att se denna vy.</div>
          </div>
        </div>
      )
    }
  }

  const tabs: { key: AdminTab; label: string }[] = [
    { key: 'users', label: 'Agenter' },
    { key: 'offices', label: 'Kontor & Utbildning' },
    { key: 'config', label: 'Systemkonfiguration' },
  ]

  const renderListPanel = () => {
    switch (activeTab) {
      case 'users':
        return (
          <AdminUserList
            selectedUser={selectedUser}
            onSelectUser={(username) => guardNavigation(() => {
              setSelectedUser(username)
              setCreatingUser(false)
              setEditingUser(null)
            })}
            onNewUser={() => guardNavigation(() => {
              setSelectedUser(null)
              setCreatingUser(true)
              setEditingUser(null)
            })}
          />
        )
      case 'offices':
        return (
          <AdminOfficeList
            selectedOffice={selectedOffice}
            onSelectOffice={(tag) => guardNavigation(() => {
              setSelectedOffice(tag)
              setCreatingOffice(false)
            })}
            onNewOffice={() => guardNavigation(() => {
              setSelectedOffice(null)
              setCreatingOffice(true)
            })}
          />
        )
      case 'config':
        return (
          <AdminConfigNav
            selectedSection={selectedConfigSection}
            onSelectSection={(section) => guardNavigation(() => {
              setSelectedConfigSection(section)
            })}
          />
        )
      default:
        return null
    }
  }

  const renderDetailPanel = () => {
    // Creating new user
    if (creatingUser) {
      return (
        <AdminUserForm
          onDirtyChange={setFormDirty}
          onSaved={(username) => {
            setCreatingUser(false)
            setSelectedUser(username)
            setFormDirty(false)
          }}
          onCancel={() => {
            setCreatingUser(false)
            setFormDirty(false)
          }}
        />
      )
    }

    // Editing user
    if (editingUser) {
      return (
        <AdminUserForm
          editUser={editingUser}
          onDirtyChange={setFormDirty}
          onSaved={(username) => {
            setEditingUser(null)
            setSelectedUser(username)
            setFormDirty(false)
          }}
          onCancel={() => {
            setEditingUser(null)
            setFormDirty(false)
          }}
        />
      )
    }

    // Creating new office
    if (creatingOffice) {
      return (
        <AdminOfficeForm
          onDirtyChange={setFormDirty}
          onSaved={(tag) => {
            setCreatingOffice(false)
            setSelectedOffice(tag)
            setFormDirty(false)
          }}
          onCancel={() => {
            setCreatingOffice(false)
            setFormDirty(false)
          }}
        />
      )
    }

    // User detail
    if (activeTab === 'users' && selectedUser) {
      return (
        <AdminUserDetail
          username={selectedUser}
          onEdit={(userData) => setEditingUser(userData)}
        />
      )
    }

    // Office detail
    if (activeTab === 'offices' && selectedOffice) {
      return (
        <AdminOfficeDetail
          routingTag={selectedOffice}
          onDirtyChange={setFormDirty}
        />
      )
    }

    // Config detail
    if (activeTab === 'config' && selectedConfigSection) {
      return <AdminConfigDetail section={selectedConfigSection} />
    }

    // Default placeholder
    return (
      <div className="hero-placeholder" id="admin-placeholder">
        <div className="hero-content">
          <div className="hero-fg-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
            </svg>
          </div>
          <div className="hero-title">Admin Dashboard</div>
          <div className="hero-subtitle">Välj en agent eller ett kontor för att hantera inställningar.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="layout-split" id="view-admin" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Admin</h2>
          <div className="header-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`header-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => switchTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </header>
        {renderListPanel()}
      </div>

      <div className="detail-panel">
        {renderDetailPanel()}
      </div>
    </div>
  )
}
