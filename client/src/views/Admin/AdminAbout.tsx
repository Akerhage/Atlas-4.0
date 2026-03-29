import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { useTheme } from '../../context/ThemeContext'
import { ATLAS_VERSION } from '../../utils/constants'

interface UserStats {
  active_tickets: number
  archived_tickets: number
  mail_handled: number
  internal_sent: number
  total_active: number
  total_archived: number
  ai_solved: number
  human_handled: number
}

export default function AdminAbout() {
  const { user } = useAuth()
  const { isConnected } = useSocket()
  const { currentTheme, setTheme } = useTheme()
  const [serverVersion, setServerVersion] = useState('...')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem('atlas-sound-enabled') !== 'false'
  )

  useEffect(() => {
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
      'ngrok-skip-browser-warning': 'true',
    }

    // Fetch server version
    fetch('/api/public/version', { headers })
      .then(r => r.json())
      .then(data => setServerVersion(data.version || data))
      .catch(() => setServerVersion('Okänd'))

    // Fetch user stats
    if (user?.username) {
      fetch(`/api/admin/user-stats/${user.username}`, { headers })
        .then(r => r.json())
        .then(setStats)
        .catch(console.error)
    }
  }, [user?.username])

  const handleSoundToggle = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    localStorage.setItem('atlas-sound-enabled', String(next))
  }

  const themes = [
    { key: 'atlas-navigator', label: 'Atlas Navigator' },
    { key: 'atlas-minimal', label: 'Atlas Minimal' },
    { key: 'atlas-nebula', label: 'Atlas Nebula' },
    { key: 'apple-dark', label: 'Apple Dark' },
    { key: 'apple-road', label: 'Apple Road' },
  ]

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 20 }}>Om Atlas</h3>

        {/* Version & Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div className="admin-stat-cell" style={{ padding: 16, background: 'var(--bg-dark-secondary)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>App-version</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>v{ATLAS_VERSION}</div>
          </div>
          <div className="admin-stat-cell" style={{ padding: 16, background: 'var(--bg-dark-secondary)', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 4 }}>Server</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{serverVersion}</div>
          </div>
        </div>

        {/* Connection status */}
        <div style={{ padding: 16, background: 'var(--bg-dark-secondary)', borderRadius: 8, marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isConnected ? '#2ecc71' : '#ff4444',
            }} />
            <span style={{ color: 'var(--text-primary)', fontSize: 14 }}>
              {isConnected ? 'Ansluten till servern' : 'Frånkopplad'}
            </span>
          </div>
        </div>

        {/* My Stats */}
        {stats && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Min statistik</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {[
                { label: 'Aktiva', value: stats.active_tickets },
                { label: 'Arkiverade', value: stats.archived_tickets },
                { label: 'Mail', value: stats.mail_handled },
                { label: 'Interna', value: stats.internal_sent },
              ].map(s => (
                <div key={s.label} style={{ padding: 12, background: 'var(--bg-dark-secondary)', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings */}
        <div style={{ marginBottom: 24 }}>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Inställningar</h4>

          {/* Theme */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-dark-secondary)', borderRadius: 8, marginBottom: 8 }}>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>Tema</label>
            <select
              value={currentTheme}
              onChange={(e) => setTheme(e.target.value)}
              className="ln-input"
              style={{ width: '100%' }}
            >
              {themes.map(t => (
                <option key={t.key} value={t.key}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Sound */}
          <div style={{ padding: '12px 16px', background: 'var(--bg-dark-secondary)', borderRadius: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={handleSoundToggle}
              />
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Notifikationsljud</span>
            </label>
          </div>
        </div>

        {/* Shortcuts */}
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>Kortkommandon</h4>
          <div style={{ display: 'grid', gap: 6 }}>
            {[
              { keys: 'Ctrl + C', desc: 'Kopiera' },
              { keys: 'Ctrl + P', desc: 'Klistra in till ärende' },
              { keys: 'Ctrl + Alt + P', desc: 'Klistra in markerad text' },
              { keys: 'Ctrl + S', desc: 'Spara (i formulär)' },
              { keys: 'Ctrl + Alt + T', desc: 'Växla tema' },
            ].map(s => (
              <div key={s.keys} style={{ display: 'flex', gap: 12, padding: '8px 12px', background: 'var(--bg-dark-secondary)', borderRadius: 6 }}>
                <code style={{ fontSize: 12, color: 'var(--accent-primary)', minWidth: 120 }}>{s.keys}</code>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
