import { useState, useEffect, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { useDataStore } from '../hooks/useDataStore'
import { team } from '../services/api'
import { getAgentStyles, resolveLabel, smartTime, stripHtml } from '../utils/styling'
import TicketDetail from '../components/TicketDetail'
import type { Ticket } from '../types'

type MyTab = 'chats' | 'mail'

export default function MyTickets() {
  const { socket } = useSocket()
  const { user } = useAuth()
  const { officeData, usersCache } = useDataStore()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<MyTab>('chats')
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTickets = useCallback(async () => {
    try {
      const allTickets = await team.fetchInbox()
      const mine = allTickets.filter(
        (t: Ticket) => t.owner === user?.username && t.status === 'claimed'
      )
      setTickets(mine)
    } catch (err) {
      console.error('Failed to fetch my tickets:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.username])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    if (!socket) return
    let debounce: ReturnType<typeof setTimeout>

    const handleUpdate = () => {
      clearTimeout(debounce)
      debounce = setTimeout(fetchTickets, 350)
    }

    socket.on('team:update', handleUpdate)
    socket.on('team:customer_reply', handleUpdate)

    return () => {
      clearTimeout(debounce)
      socket.off('team:update', handleUpdate)
      socket.off('team:customer_reply', handleUpdate)
    }
  }, [socket, fetchTickets])

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'chats') return t.channel === 'chat'
    if (activeTab === 'mail') return t.channel === 'mail'
    return false
  })

  const tabs: { key: MyTab; label: string }[] = [
    { key: 'chats', label: 'Chattar' },
    { key: 'mail', label: 'Mail' },
  ]

  return (
    <div className="layout-split" id="view-my-tickets" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Mina ärenden</h2>
          <div className="header-tabs">
            {tabs.map(tab => {
              const count = tickets.filter(t => t.channel === tab.key.replace('s', '')).length
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
        </header>

        <div className="ticket-list">
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && filteredTickets.length === 0 && (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-title">Inga ärenden</div>
                <div className="hero-subtitle">Du har inga aktiva ärenden i denna kategori.</div>
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
          <div className="hero-placeholder" id="my-detail-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <path d="M8 7h8" />
                  <path d="M8 11h5" />
                </svg>
              </div>
              <div className="hero-title">Mina Ärenden</div>
              <div className="hero-subtitle">Fortsätt konversationen genom att välja en av dina aktiva chattar.</div>
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
