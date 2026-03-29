import { useState, useEffect } from 'react'
import { showToast } from '../../components/ToastContainer'

interface DriftSettings {
  [key: string]: unknown
}

interface BlocklistEntry {
  id: number
  pattern: string
}

export default function AdminDrift() {
  const [settings, setSettings] = useState<DriftSettings>({})
  const [blocklist, setBlocklist] = useState<BlocklistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [unlockedFields, setUnlockedFields] = useState<Set<string>>(new Set())

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
    'ngrok-skip-browser-warning': 'true',
  }

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [settingsRes, blocklistRes] = await Promise.all([
          fetch('/api/admin/operation-settings', { headers }).then(r => r.json()),
          fetch('/api/admin/email-blocklist', { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        ])
        setSettings(settingsRes)
        setBlocklist(Array.isArray(blocklistRes) ? blocklistRes : [])
      } catch (err) {
        console.error('Failed to load drift settings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const toggleField = (field: string) => {
    setUnlockedFields(prev => {
      const next = new Set(prev)
      if (next.has(field)) next.delete(field)
      else next.add(field)
      return next
    })
  }

  const saveField = async (field: string, value: unknown) => {
    try {
      await fetch('/api/admin/operation-settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ field, value }),
      })
      setSettings(prev => ({ ...prev, [field]: value }))
      setUnlockedFields(prev => { const next = new Set(prev); next.delete(field); return next })
      showToast('Inställning sparad.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte spara.', 3000, 'error')
    }
  }

  const addBlocklistEntry = async () => {
    const pattern = window.prompt('Ange e-postmönster att blockera (t.ex. *@spam.com):')
    if (!pattern?.trim()) return
    try {
      const res = await fetch('/api/admin/email-blocklist', {
        method: 'POST',
        headers,
        body: JSON.stringify({ pattern: pattern.trim() }),
      })
      const entry = await res.json()
      setBlocklist(prev => [...prev, entry])
      showToast('Blockerat mönster tillagt.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte lägga till.', 3000, 'error')
    }
  }

  const deleteBlocklistEntry = async (id: number) => {
    if (!window.confirm('Radera detta blockerat mönster?')) return
    try {
      await fetch(`/api/admin/email-blocklist/${id}`, { method: 'DELETE', headers })
      setBlocklist(prev => prev.filter(e => e.id !== id))
      showToast('Mönster borttaget.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte radera.', 3000, 'error')
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 20 }}>Drift & Säkerhet</h3>

        {/* Settings fields */}
        {Object.entries(settings).map(([key, value]) => {
          const isUnlocked = unlockedFields.has(key)
          const isBoolean = typeof value === 'boolean'

          return (
            <div
              key={key}
              className="admin-config-field"
              style={{
                marginBottom: 12,
                padding: '12px 16px',
                background: 'var(--bg-dark-secondary)',
                borderRadius: 8,
                opacity: isUnlocked ? 1 : 0.7,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{key}</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isUnlocked && (
                    <button
                      className="btn-glass-small"
                      style={{ fontSize: 11, padding: '2px 8px' }}
                      onClick={() => {
                        const input = document.getElementById(`drift-${key}`) as HTMLInputElement
                        if (input) {
                          const val = isBoolean ? input.checked : input.value
                          saveField(key, val)
                        }
                      }}
                    >
                      Spara
                    </button>
                  )}
                  <button
                    className="admin-lock-btn"
                    style={{ fontSize: 11 }}
                    onClick={() => toggleField(key)}
                  >
                    {isUnlocked ? 'Lås' : 'Lås upp'}
                  </button>
                </div>
              </div>
              {isBoolean ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isUnlocked ? 'pointer' : 'default' }}>
                  <input
                    id={`drift-${key}`}
                    type="checkbox"
                    defaultChecked={value as boolean}
                    disabled={!isUnlocked}
                  />
                  <span style={{ fontSize: 13, color: value ? '#2ecc71' : '#ff4444' }}>
                    {value ? 'Aktiverat' : 'Inaktiverat'}
                  </span>
                </label>
              ) : (
                <input
                  id={`drift-${key}`}
                  type="text"
                  defaultValue={String(value ?? '')}
                  disabled={!isUnlocked}
                  className="ln-input"
                  style={{ width: '100%', fontSize: 13 }}
                />
              )}
            </div>
          )
        })}

        {/* Email Blocklist */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ color: 'var(--text-secondary)' }}>E-post blocklista</h4>
            <button className="btn-glass-small" onClick={addBlocklistEntry} style={{ fontSize: 12 }}>
              + Lägg till
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocklist.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 12 }}>Inga blockerade mönster.</div>
            )}
            {blocklist.map(entry => (
              <div
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: 'var(--bg-dark-secondary)',
                  borderRadius: 6,
                }}
              >
                <code style={{ fontSize: 12, color: 'var(--text-primary)' }}>{entry.pattern}</code>
                <button
                  onClick={() => deleteBlocklistEntry(entry.id)}
                  style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 14 }}
                  title="Radera"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
