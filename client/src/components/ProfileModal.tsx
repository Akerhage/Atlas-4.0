import { useState, useEffect } from 'react'
import './Modal.css'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useDataStore } from '../hooks/useDataStore'
import { showToast } from './ToastContainer'
import { AVATAR_ICONS } from '../utils/constants'

interface Props {
  onClose: () => void
}

export default function ProfileModal({ onClose }: Props) {
  const { user, updateUser } = useAuth()
  const { setAccentColor } = useTheme()
  const { refreshUsers } = useDataStore()

  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [color, setColor] = useState(user?.agent_color || '#0071e3')
  const [avatarId, setAvatarId] = useState(user?.avatar_id ?? 0)
  const [statusText, setStatusText] = useState(user?.status_text || '')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = async () => {
    if (newPassword && newPassword !== newPassword2) {
      showToast('Lösenorden matchar inte.', 3000, 'error')
      return
    }
    if (newPassword && newPassword.length < 6) {
      showToast('Lösenordet måste vara minst 6 tecken.', 3000, 'error')
      return
    }

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        display_name: displayName.trim(),
        agent_color: color,
        avatar_id: avatarId,
        status_text: statusText.trim(),
      }
      if (newPassword) {
        payload.old_password = oldPassword
        payload.new_password = newPassword
      }

      const res = await fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Fel: ${res.status}`)
      }

      // Update local state
      updateUser({
        display_name: displayName.trim(),
        agent_color: color,
        avatar_id: avatarId,
        status_text: statusText.trim(),
      })
      setAccentColor(color)
      refreshUsers()
      showToast('Profil uppdaterad!', 2000, 'success')
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Kunde inte spara profil.', 3000, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, maxHeight: '85vh', overflow: 'auto' }}>
        {/* Header */}
        <div
          className="glass-modal-header"
          style={{ background: `linear-gradient(135deg, ${color}15, transparent)`, borderBottom: `2px solid ${color}` }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: '50%', border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fill: 'currentColor',
              }}
              dangerouslySetInnerHTML={{ __html: AVATAR_ICONS[avatarId] || '' }}
            />
            <h3 style={{ margin: 0 }}>{displayName || user?.username || 'Profil'}</h3>
          </div>
        </div>

        <div className="glass-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Avatar picker */}
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Avatar</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {AVATAR_ICONS.map((svg, idx) => (
                <div
                  key={idx}
                  onClick={() => setAvatarId(idx)}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', cursor: 'pointer',
                    border: `2px solid ${avatarId === idx ? color : 'var(--border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: avatarId === idx ? color : 'var(--text-tertiary)',
                    fill: 'currentColor',
                    background: avatarId === idx ? `${color}15` : 'transparent',
                  }}
                  dangerouslySetInnerHTML={{ __html: svg }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Visningsnamn</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="ln-input" style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Färg</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: '100%', height: 36, marginTop: 4, border: 'none', cursor: 'pointer' }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Statusmeddelande</label>
            <input type="text" value={statusText} onChange={e => setStatusText(e.target.value)} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="T.ex. Lunch 12-13" maxLength={50} />
          </div>

          {/* Password change */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8, display: 'block' }}>Byt lösenord</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="ln-input" style={{ width: '100%' }} placeholder="Nuvarande lösenord" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="ln-input" placeholder="Nytt lösenord" />
                <input type="password" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} className="ln-input" placeholder="Bekräfta" />
              </div>
              {newPassword && newPassword2 && (
                <span style={{ fontSize: 11, color: newPassword === newPassword2 ? '#2ecc71' : '#ff4444' }}>
                  {newPassword === newPassword2 ? '✓ Matchar' : '✗ Matchar inte'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="glass-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-modal-cancel" onClick={onClose}>Avbryt</button>
          <button className="btn-modal-confirm" onClick={handleSave} disabled={saving}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>
    </div>
  )
}
