import { useState, useEffect, useCallback } from 'react'
import { offices as officesApi } from '../../services/api'
import { useDataStore } from '../../hooks/useDataStore'
import { showToast } from '../../components/ToastContainer'
import { AVATAR_ICONS } from '../../utils/constants'
import type { Office, User } from '../../types'

interface Props {
  editUser?: unknown
  onDirtyChange: (dirty: boolean) => void
  onSaved: (username: string) => void
  onCancel: () => void
}

const VIEW_PERMISSIONS = [
  { key: 'chat', label: 'Hem' },
  { key: 'my-tickets', label: 'Mina ärenden' },
  { key: 'inbox', label: 'Inkorgen' },
  { key: 'archive', label: 'Garaget' },
  { key: 'customers', label: 'Kunder' },
  { key: 'templates', label: 'Mailmallar' },
  { key: 'admin-users', label: 'Admin: Agenter' },
  { key: 'admin-offices', label: 'Admin: Kontor' },
  { key: 'admin-config', label: 'Admin: System' },
]

export default function AdminUserForm({ editUser, onDirtyChange, onSaved, onCancel }: Props) {
  const { refreshUsers } = useDataStore()
  const edit = editUser as User | undefined

  const [username, setUsername] = useState(edit?.username || '')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [displayName, setDisplayName] = useState(edit?.display_name || '')
  const [role, setRole] = useState<string>(edit?.role || 'agent')
  const [color, setColor] = useState(edit?.agent_color || '#0071e3')
  const [avatarId, setAvatarId] = useState(edit?.avatar_id ?? 0)
  const [selectedOffices, setSelectedOffices] = useState<string[]>([])
  const [selectedViews, setSelectedViews] = useState<string[]>([])
  const [allOffices, setAllOffices] = useState<Office[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    officesApi.getAll().then(setAllOffices).catch(console.error)
  }, [])

  // Parse existing office/view permissions for edit mode
  useEffect(() => {
    if (edit) {
      // Parse offices from user data (would need API endpoint or user field)
      if (edit.allowed_views) {
        try {
          setSelectedViews(JSON.parse(edit.allowed_views))
        } catch { /* ignore */ }
      }
    }
  }, [edit])

  const markDirty = useCallback(() => onDirtyChange(true), [onDirtyChange])

  const toggleOffice = (tag: string) => {
    markDirty()
    setSelectedOffices(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const toggleView = (key: string) => {
    markDirty()
    setSelectedViews(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const passwordsMatch = password === password2 && password.length >= 6

  const handleSave = async () => {
    if (!username.trim()) {
      showToast('Användarnamn krävs.', 3000, 'error')
      return
    }
    if (!edit && !passwordsMatch) {
      showToast('Lösenorden matchar inte eller är för korta (minst 6 tecken).', 3000, 'error')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        username: username.trim(),
        display_name: displayName.trim() || username.trim(),
        role,
        agent_color: color,
        avatar_id: avatarId,
        offices: selectedOffices.join(','),
        allowed_views: selectedViews.length > 0 ? JSON.stringify(selectedViews) : null,
      }

      if (!edit) {
        payload.password = password
        await fetch('/api/admin/create-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify(payload),
        })
        showToast('Agent skapad!', 3000, 'success')
      } else {
        if (password.length > 0) payload.password = password
        await fetch('/api/admin/update-user-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ ...payload, userId: edit.id }),
        })
        showToast('Agent uppdaterad!', 3000, 'success')
      }

      refreshUsers()
      onSaved(username.trim())
    } catch (err) {
      showToast('Kunde inte spara agent.', 3000, 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  // Group offices by city
  const officesByCity = allOffices.reduce<Record<string, Office[]>>((acc, o) => {
    const city = o.city || 'Övrigt'
    if (!acc[city]) acc[city] = []
    acc[city].push(o)
    return acc
  }, {})

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      {/* Header with live preview */}
      <div
        id="na-form-header"
        style={{
          background: `linear-gradient(135deg, ${color}22, transparent)`,
          borderBottom: `2px solid ${color}`,
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
            fill: 'currentColor',
          }}
          dangerouslySetInnerHTML={{ __html: AVATAR_ICONS[avatarId] || '' }}
        />
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
            {displayName || username || (edit ? 'Redigera agent' : 'Ny agent')}
          </h3>
          <span className="pill" style={{ background: `${color}33`, color, marginTop: 4 }}>
            {role.toUpperCase()}
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-modal-confirm" onClick={handleSave} disabled={saving}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          <button className="btn-modal-cancel" onClick={onCancel}>Avbryt</button>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar picker */}
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8, display: 'block' }}>Avatar</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {AVATAR_ICONS.map((svg, idx) => (
              <div
                key={idx}
                className={`new-agent-avatar-opt${avatarId === idx ? ' selected' : ''}`}
                onClick={() => { setAvatarId(idx); markDirty() }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: `2px solid ${avatarId === idx ? color : 'var(--border-color)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: avatarId === idx ? color : 'var(--text-tertiary)',
                  fill: 'currentColor',
                  background: avatarId === idx ? `${color}15` : 'transparent',
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ))}
          </div>
        </div>

        {/* Basic fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Användarnamn</label>
            <input
              type="text"
              value={username}
              onChange={(e) => { setUsername(e.target.value); markDirty() }}
              disabled={!!edit}
              className="ln-input"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Visningsnamn</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); markDirty() }}
              className="ln-input"
              style={{ width: '100%', marginTop: 4 }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {edit ? 'Nytt lösenord (lämna tomt för att behålla)' : 'Lösenord'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); markDirty() }}
              className="ln-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Minst 6 tecken"
            />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Bekräfta lösenord</label>
            <input
              type="password"
              value={password2}
              onChange={(e) => { setPassword2(e.target.value); markDirty() }}
              className="ln-input"
              style={{ width: '100%', marginTop: 4 }}
            />
            {password.length > 0 && (
              <span style={{ fontSize: 11, color: passwordsMatch ? '#2ecc71' : '#ff4444', marginTop: 4, display: 'block' }}>
                {passwordsMatch ? '✓ Lösenorden matchar' : '✗ Lösenorden matchar inte'}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Roll</label>
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value); markDirty() }}
              className="ln-input"
              style={{ width: '100%', marginTop: 4 }}
            >
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Färg</label>
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); markDirty() }}
              style={{ width: '100%', height: 36, marginTop: 4, border: 'none', cursor: 'pointer' }}
            />
          </div>
        </div>

        {/* Office permissions */}
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8, display: 'block' }}>Kontorsrättigheter</label>
          {Object.entries(officesByCity).map(([city, cityOffices]) => (
            <div key={city} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>{city}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {cityOffices.map(o => {
                  const isChecked = selectedOffices.includes(o.routing_tag)
                  return (
                    <label
                      key={o.routing_tag}
                      className="pill"
                      style={{
                        cursor: 'pointer',
                        background: isChecked ? `${o.office_color}33` : 'var(--bg-dark-secondary)',
                        color: isChecked ? o.office_color : 'var(--text-tertiary)',
                        border: `1px solid ${isChecked ? o.office_color : 'var(--border-color)'}`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOffice(o.routing_tag)}
                        style={{ display: 'none' }}
                      />
                      {o.area || o.name}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* View permissions */}
        <div>
          <label style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 8, display: 'block' }}>Vy-behörigheter</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {VIEW_PERMISSIONS.map(vp => {
              const isActive = selectedViews.includes(vp.key)
              return (
                <button
                  key={vp.key}
                  className="pill"
                  onClick={() => toggleView(vp.key)}
                  style={{
                    cursor: 'pointer',
                    background: isActive ? `${color}33` : 'var(--bg-dark-secondary)',
                    color: isActive ? color : 'var(--text-tertiary)',
                    border: `1px solid ${isActive ? color : 'var(--border-color)'}`,
                  }}
                >
                  {vp.label}
                </button>
              )
            })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Tomt = alla vyer tillgängliga
          </div>
        </div>
      </div>
    </div>
  )
}
