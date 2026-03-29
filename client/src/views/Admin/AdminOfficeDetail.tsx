import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useDataStore } from '../../hooks/useDataStore'
import { getAgentStyles, resolveLabel, smartTime } from '../../utils/styling'
import { showToast } from '../../components/ToastContainer'
import type { Office, Ticket, User } from '../../types'

interface Props {
  routingTag: string
  onDirtyChange: (dirty: boolean) => void
}

interface OfficeKnowledge {
  contact?: { phone?: string; email?: string; address?: string }
  info?: { languages?: string[]; opening_hours?: Record<string, string> }
  prices?: Array<{ category: string; price: string; keywords?: string }>
  sections?: Array<{ title: string; answer: string }>
}

export default function AdminOfficeDetail({ routingTag, onDirtyChange }: Props) {
  const { user: currentUser } = useAuth()
  const { officeData, usersCache, refreshOffices } = useDataStore()
  const [office, setOffice] = useState<Office | null>(null)
  const [knowledge, setKnowledge] = useState<OfficeKnowledge | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [agents, setAgents] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [colorValue, setColorValue] = useState('')
  const [unlockedSections, setUnlockedSections] = useState<Set<string>>(new Set())
  const colorDebounce = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      try {
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        }

        const [officesRes, knowledgeRes, ticketsRes, usersRes] = await Promise.all([
          fetch('/api/public/offices', { headers }).then(r => r.json()),
          fetch(`/api/knowledge/${routingTag}`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/admin/office-tickets/${routingTag}`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
          fetch('/api/auth/users', { headers }).then(r => r.json()),
        ])

        const found = officesRes.find((o: Office) => o.routing_tag === routingTag)
        setOffice(found || null)
        setColorValue(found?.office_color || '#0071e3')
        setKnowledge(knowledgeRes)
        setTickets(Array.isArray(ticketsRes) ? ticketsRes : [])

        // Filter agents assigned to this office
        const officeAgents = usersRes.filter((u: User) => {
          // Check if agent has this office in their offices string
          return u.role === 'agent' || u.role === 'admin'
        })
        setAgents(officeAgents)
      } catch (err) {
        console.error('Failed to fetch office detail:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [routingTag])

  const handleColorChange = (newColor: string) => {
    setColorValue(newColor)
    onDirtyChange(true)
    clearTimeout(colorDebounce.current)
    colorDebounce.current = setTimeout(async () => {
      try {
        await fetch('/api/admin/update-office-color', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({ routing_tag: routingTag, color: newColor }),
        })
        refreshOffices()
        onDirtyChange(false)
      } catch (err) {
        console.error('Failed to update office color:', err)
      }
    }, 700)
  }

  const toggleSection = (section: string) => {
    setUnlockedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const handleDeleteOffice = async () => {
    if (!office) return
    if (!window.confirm(`Är du säker på att du vill radera kontoret "${office.name}"?`)) return
    try {
      await fetch(`/api/admin/office/${routingTag}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
      })
      showToast('Kontoret har raderats.', 3000, 'success')
      refreshOffices()
    } catch (err) {
      showToast('Kunde inte radera kontoret.', 3000, 'error')
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>
  if (!office) return <div style={{ padding: 20 }}>Kontoret hittades inte.</div>

  const color = colorValue || office.office_color || '#0071e3'
  const initial = (office.area || office.name || '?').charAt(0).toUpperCase()
  const styles = getAgentStyles(routingTag, officeData, usersCache, currentUser)

  return (
    <div className="admin-detail-content" id="admin-detail-content" data-current-id={routingTag}>
      {/* Header */}
      <div className="detail-header-top" style={{ borderBottom: `2px solid ${color}` }}>
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
            fontWeight: 700,
            fontSize: 20,
            background: `${color}15`,
            flexShrink: 0,
          }}
        >
          {initial}
        </div>
        <div className="detail-header-info">
          <h3 className="detail-subject">{office.name}</h3>
          <div className="header-pills-row">
            <span className="pill" style={{ background: styles.tagBg, color: styles.main }}>
              {resolveLabel(routingTag, officeData)}
            </span>
            <span className="pill" style={{ background: 'var(--bg-dark-secondary)', color: 'var(--text-secondary)' }}>
              {office.city}
            </span>
          </div>
        </div>
        <div className="detail-header-actions">
          <input
            type="color"
            value={color}
            onChange={(e) => handleColorChange(e.target.value)}
            title="Kontorsfärg"
            style={{ width: 32, height: 32, border: 'none', cursor: 'pointer', background: 'transparent' }}
          />
          <button className="icon-only-btn" onClick={handleDeleteOffice} title="Radera kontor" style={{ color: '#ff4444' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Two-column: Tickets + Agents */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '16px 20px' }}>
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 13 }}>
            Ärenden ({tickets.length})
          </h4>
          <div className="scroll-list" style={{ maxHeight: 250, overflowY: 'auto' }}>
            {tickets.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 8 }}>Inga ärenden.</div>
            )}
            {tickets.map(t => (
              <div
                key={t.conversation_id}
                className="admin-ticket-preview"
                style={{ borderLeft: `3px solid ${color}`, padding: '8px 12px', marginBottom: 6 }}
              >
                <div style={{ fontSize: 12 }}>{t.customer_name || t.customer_email || 'Anonym'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                  {smartTime(t.updated_at || t.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 13 }}>
            Kopplade agenter
          </h4>
          <div className="scroll-list" style={{ maxHeight: 250, overflowY: 'auto' }}>
            {agents.length === 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: 8 }}>Inga agenter.</div>
            )}
            {agents.slice(0, 10).map(a => (
              <div key={a.username} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: a.is_online ? '#2ecc71' : '#95a5a6',
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {a.display_name || a.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Contact info section */}
      <div style={{ padding: '0 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Kontaktuppgifter</h4>
          <button
            className="admin-lock-btn"
            onClick={() => toggleSection('contact')}
            style={{ fontSize: 11 }}
          >
            {unlockedSections.has('contact') ? 'Lås' : 'Lås upp'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, opacity: unlockedSections.has('contact') ? 1 : 0.6 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Telefon</label>
            <input
              type="text"
              defaultValue={office.phone || knowledge?.contact?.phone || ''}
              disabled={!unlockedSections.has('contact')}
              className="ln-input"
              style={{ width: '100%', marginTop: 2, fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>E-post</label>
            <input
              type="text"
              defaultValue={office.email || knowledge?.contact?.email || ''}
              disabled={!unlockedSections.has('contact')}
              className="ln-input"
              style={{ width: '100%', marginTop: 2, fontSize: 13 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Adress</label>
            <input
              type="text"
              defaultValue={knowledge?.contact?.address || ''}
              disabled={!unlockedSections.has('contact')}
              className="ln-input"
              style={{ width: '100%', marginTop: 2, fontSize: 13 }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
