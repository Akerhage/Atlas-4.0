import { useState, useEffect, useCallback } from 'react'
import '../components/TicketCard.css'
import { useAuth } from '../context/AuthContext'
import { useDataStore } from '../hooks/useDataStore'
import { archive as archiveApi } from '../services/api'
import { getAgentStyles, resolveLabel, smartTime, stripHtml } from '../utils/styling'
import TicketDetail from '../components/TicketDetail'
import type { Ticket } from '../types'

export default function Archive() {
  const { user } = useAuth()
  const { officeData, usersCache } = useDataStore()
  const [items, setItems] = useState<Ticket[]>([])
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const fetchArchive = useCallback(async () => {
    try {
      setLoading(true)
      const data = await archiveApi.getAll({ search: search || undefined })
      setItems(data.items)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to fetch archive:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(fetchArchive, 300)
    return () => clearTimeout(debounce)
  }, [fetchArchive])

  return (
    <div className="layout-split" id="view-archive" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Garaget</h2>
          <div className="header-actions">
            <input
              type="text"
              className="search-input"
              placeholder="Sök ärenden..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="result-count">{total} ärenden</span>
          </div>
        </header>

        <div className="ticket-list">
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && items.length === 0 && (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-title">Inga arkiverade ärenden</div>
                <div className="hero-subtitle">
                  {search ? 'Inga resultat matchar din sökning.' : 'Arkivet är tomt.'}
                </div>
              </div>
            </div>
          )}
          {items.map(ticket => {
            const styles = getAgentStyles(
              ticket.routing_tag || ticket.owner,
              officeData,
              usersCache,
              user,
            )
            const label = resolveLabel(ticket.routing_tag, officeData)
            const isSelected = selectedTicket === ticket.conversation_id

            return (
              <div
                key={ticket.conversation_id}
                className={`team-ticket-card${isSelected ? ' selected' : ''}`}
                style={{
                  borderLeft: `3px solid ${styles.main}`,
                  background: isSelected ? styles.bg : undefined,
                }}
                onClick={() => setSelectedTicket(ticket.conversation_id)}
              >
                <div className="ticket-card-header">
                  <span className="pill" style={{ background: styles.tagBg, color: styles.main }}>
                    {label}
                  </span>
                  <span className="ticket-time">{smartTime(ticket.updated_at || ticket.created_at)}</span>
                </div>
                <div className="ticket-card-subject">
                  {ticket.customer_name || ticket.customer_email || 'Anonym'}
                </div>
                <div className="ticket-card-preview">
                  {stripHtml(ticket.last_message)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedTicket ? (
          <div className="hero-placeholder" id="archive-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
                  <path d="M2 10h20" />
                </svg>
              </div>
              <div className="hero-title">Garaget</div>
              <div className="hero-subtitle">Sök och filtrera bland alla dina avslutade och arkiverade ärenden.</div>
            </div>
          </div>
        ) : (
          <TicketDetail
            conversationId={selectedTicket}
            onArchived={() => { setSelectedTicket(null); fetchArchive() }}
            onDeleted={() => { setSelectedTicket(null); fetchArchive() }}
          />
        )}
      </div>
    </div>
  )
}
