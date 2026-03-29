import { useState, useEffect } from 'react'
import AdminAbout from './AdminAbout'
import AdminDrift from './AdminDrift'
import AdminKnowledge from './AdminKnowledge'
import AdminGaps from './AdminGaps'

interface Props {
  section: string
}

interface ConfigData {
  [key: string]: unknown
}

export default function AdminConfigDetail({ section }: Props) {
  const [config, setConfig] = useState<ConfigData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchConfig = async () => {
      setLoading(true)
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        }

        let data: ConfigData = {}

        if (['network', 'ai', 'email'].includes(section)) {
          const res = await fetch('/api/admin/system-config', { headers })
          data = await res.json()
        } else if (section === 'drift') {
          const res = await fetch('/api/admin/operation-settings', { headers })
          data = await res.json()
        } else if (section === 'rag') {
          const res = await fetch('/api/admin/rag-scores', { headers })
          data = await res.json()
        } else if (section === 'booking') {
          const res = await fetch('/api/admin/booking-links', { headers })
          data = await res.json()
        } else if (section === 'ts-urls') {
          const res = await fetch('/api/admin/ts-urls', { headers })
          data = await res.json()
        }

        setConfig(data)
      } catch (err) {
        console.error('Failed to fetch config:', err)
      } finally {
        setLoading(false)
      }
    }

    if (!['about', 'knowledge', 'gaps', 'drift'].includes(section)) {
      fetchConfig()
    } else {
      setLoading(false)
    }
  }, [section])

  // Delegate to specialized components
  if (section === 'about') return <AdminAbout />
  if (section === 'drift') return <AdminDrift />
  if (section === 'knowledge') return <AdminKnowledge />
  if (section === 'gaps') return <AdminGaps />

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>

  // Generic config renderer for network, ai, email, rag, booking, ts-urls
  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 16 }}>
          {section === 'network' && 'Nätverkskonfiguration'}
          {section === 'ai' && 'AI & LLM-inställningar'}
          {section === 'email' && 'E-post & IMAP'}
          {section === 'rag' && 'RAG-Scoring'}
          {section === 'booking' && 'Bokningslänkar'}
          {section === 'ts-urls' && 'Transportstyrelsen-URLar'}
        </h3>

        {config && Object.entries(config).map(([key, value]) => (
          <div key={key} className="admin-config-field" style={{ marginBottom: 12, padding: '10px 14px', background: 'var(--bg-dark-secondary)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
                {key}
              </label>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 4, wordBreak: 'break-all' }}>
              {typeof value === 'boolean' ? (
                <span style={{ color: value ? '#2ecc71' : '#ff4444' }}>{value ? 'Aktiverat' : 'Inaktiverat'}</span>
              ) : typeof value === 'object' ? (
                <pre style={{ fontSize: 11, margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>
              ) : (
                String(value ?? '—')
              )}
            </div>
          </div>
        ))}

        {(!config || Object.keys(config).length === 0) && (
          <div style={{ color: 'var(--text-tertiary)', padding: 20, textAlign: 'center' }}>
            Ingen konfigurationsdata tillgänglig.
          </div>
        )}
      </div>
    </div>
  )
}
