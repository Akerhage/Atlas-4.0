import { useState, useEffect, useCallback } from 'react'
import '../components/TicketCard.css'
import '../components/Common.css'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { useDataStore } from '../hooks/useDataStore'
import { team } from '../services/api'
import { getAgentStyles, resolveLabel, smartTime, stripHtml } from '../utils/styling'
import { showToast } from '../components/ToastContainer'
import TicketDetail from '../components/TicketDetail'
import type { Ticket } from '../types'

type InboxTab = 'chats' | 'mail' | 'claimed'

export default function Inbox() {
  const { socket } = useSocket()
  const { user } = useAuth()
  const { officeData, usersCache } = useDataStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<InboxTab>('chats')
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Bulk mode state
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const fetchTickets = useCallback(async () => {
    try {
      const data = await team.fetchInbox()
      setTickets(data)
    } catch (err) {
      console.error('Failed to fetch inbox:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  // Real-time updates
  useEffect(() => {
    if (!socket) return
    let debounce: ReturnType<typeof setTimeout>

    const handleUpdate = () => {
      clearTimeout(debounce)
      debounce = setTimeout(fetchTickets, 350)
    }

    socket.on('team:update', handleUpdate)
    socket.on('team:new_ticket', handleUpdate)
    socket.on('team:customer_message', handleUpdate)

    return () => {
      clearTimeout(debounce)
      socket.off('team:update', handleUpdate)
      socket.off('team:new_ticket', handleUpdate)
      socket.off('team:customer_message', handleUpdate)
    }
  }, [socket, fetchTickets])

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'chats') return t.channel === 'chat' && t.status === 'open'
    if (activeTab === 'mail') return t.channel === 'mail' && t.status === 'open'
    if (activeTab === 'claimed') return t.status === 'claimed'
    return false
  })

  const handleClaim = async (conversationId: string) => {
    try {
      await team.claimTicket(conversationId)
      fetchTickets()
    } catch (err) {
      console.error('Claim failed:', err)
    }
  }

  // Bulk operations
  const toggleBulkSelect = (id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exitBulkMode = () => {
    setBulkMode(false)
    setBulkSelected(new Set())
  }

  const bulkClaim = async () => {
    if (bulkSelected.size === 0) return
    try {
      await Promise.all(
        Array.from(bulkSelected).map(id => team.claimTicket(id))
      )
      showToast(`${bulkSelected.size} ärenden plockade!`, 3000, 'success')
      exitBulkMode()
      fetchTickets()
    } catch (err) {
      showToast('Bulk-plockning misslyckades.', 3000, 'error')
    }
  }

  const bulkArchive = async () => {
    if (bulkSelected.size === 0) return
    if (!window.confirm(`Arkivera ${bulkSelected.size} ärenden?`)) return
    try {
      await Promise.all(
        Array.from(bulkSelected).map(id => team.archiveTicket(id))
      )
      showToast(`${bulkSelected.size} ärenden arkiverade!`, 3000, 'success')
      exitBulkMode()
      fetchTickets()
    } catch (err) {
      showToast('Bulk-arkivering misslyckades.', 3000, 'error')
    }
  }

  const tabs: { key: InboxTab; label: string }[] = [
    { key: 'chats', label: 'Nya Live-Chattar' },
    { key: 'mail', label: 'Nya Mail-ärenden' },
    { key: 'claimed', label: 'Plockade/Routade' },
  ]

  return (
    <div className="layout-split" id="view-inbox" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Inkorgen</h2>
          <div className="header-tabs">
            {tabs.map(tab => {
              const count = tickets.filter(t => {
                if (tab.key === 'chats') return t.channel === 'chat' && t.status === 'open'
                if (tab.key === 'mail') return t.channel === 'mail' && t.status === 'open'
                if (tab.key === 'claimed') return t.status === 'claimed'
                return false
              }).length

              return (
                <button
                  key={tab.key}
                  className={`header-tab${activeTab === tab.key ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {count > 0 && <span className="notif-badge-bubble">{count}</span>}
                </button>
              )
            })}
          </div>
          <div className="header-actions" style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <button
              className={`icon-only-btn${bulkMode ? ' active' : ''}`}
              onClick={() => bulkMode ? exitBulkMode() : setBulkMode(true)}
              title={bulkMode ? 'Avsluta markering' : 'Markera flera'}
              style={{ fontSize: 12 }}
            >
              {bulkMode ? '✕' : '☑'}
            </button>
          </div>
        </header>

        {/* Bulk action toolbar */}
        {bulkMode && bulkSelected.size > 0 && (
          <div
            id="bulk-action-toolbar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              background: 'var(--bg-dark-secondary)',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <span className="bulk-count-label" style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>
              {bulkSelected.size} markerade
            </span>
            <button className="btn-glass-small" onClick={bulkClaim} style={{ fontSize: 11 }}>
              Plocka alla
            </button>
            <button className="btn-glass-small" onClick={bulkArchive} style={{ fontSize: 11, color: '#ff4444' }}>
              Arkivera alla
            </button>
            <button className="btn-glass-small" onClick={exitBulkMode} style={{ fontSize: 11 }}>
              Avbryt
            </button>
          </div>
        )}

        <div className="ticket-list">
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && filteredTickets.length === 0 && (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-title">Inga ärenden</div>
                <div className="hero-subtitle">Det finns inga ärenden i denna kategori just nu.</div>
              </div>
            </div>
          )}
          {filteredTickets.map(ticket => {
            const styles = getAgentStyles(
              ticket.routing_tag || ticket.owner,
              officeData,
              usersCache,
              user,
            )
            const label = resolveLabel(ticket.routing_tag, officeData)
            const isSelected = selectedTicket === ticket.conversation_id
            const isBulkChecked = bulkSelected.has(ticket.conversation_id)

            return (
              <div
                key={ticket.conversation_id}
                className={`team-ticket-card${isSelected ? ' selected' : ''}${isBulkChecked ? ' bulk-selected' : ''}`}
                style={{
                  borderLeft: `3px solid ${styles.main}`,
                  background: isSelected ? styles.bg : isBulkChecked ? 'rgba(0,113,227,0.06)' : undefined,
                }}
                onClick={() => bulkMode ? toggleBulkSelect(ticket.conversation_id) : setSelectedTicket(ticket.conversation_id)}
              >
                <div className="ticket-card-header">
                  {bulkMode && (
                    <input
                      type="checkbox"
                      checked={isBulkChecked}
                      onChange={() => toggleBulkSelect(ticket.conversation_id)}
                      onClick={e => e.stopPropagation()}
                      style={{ marginRight: 8, cursor: 'pointer' }}
                    />
                  )}
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
                {!bulkMode && ticket.status === 'open' && (
                  <div className="ticket-card-actions">
                    <button
                      className="btn-claim"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleClaim(ticket.conversation_id)
                      }}
                    >
                      Plocka
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedTicket ? (
          <div className="hero-placeholder" id="inbox-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <div className="hero-title">Inkorgen</div>
              <div className="hero-subtitle">Välj ett inkommande ärende för att påbörja hanteringen.</div>
            </div>
          </div>
        ) : (
          <TicketDetail
            conversationId={selectedTicket}
            onArchived={() => { setSelectedTicket(null); fetchTickets() }}
            onDeleted={() => { setSelectedTicket(null); fetchTickets() }}
          />
        )}
      </div>
    </div>
  )
}
