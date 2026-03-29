import { useState, useEffect, useCallback } from 'react'
import '../components/TicketCard.css'
import '../components/Common.css'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import { team } from '../services/api'
import { showToast } from '../components/ToastContainer'
import TicketCard from '../components/TicketCard'
import TicketDetail from '../components/TicketDetail'
import type { Ticket } from '../types'

type InboxTab = 'chats' | 'mail' | 'claimed'

export default function Inbox() {
  const { socket } = useSocket()
  useAuth() // ensure authenticated
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<InboxTab>('chats')
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

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

  useEffect(() => { fetchTickets() }, [fetchTickets])

  useEffect(() => {
    if (!socket) return
    let debounce: ReturnType<typeof setTimeout>
    const handleUpdate = () => { clearTimeout(debounce); debounce = setTimeout(fetchTickets, 350) }
    socket.on('team:update', handleUpdate)
    socket.on('team:new_ticket', handleUpdate)
    socket.on('team:customer_message', handleUpdate)
    return () => { clearTimeout(debounce); socket.off('team:update', handleUpdate); socket.off('team:new_ticket', handleUpdate); socket.off('team:customer_message', handleUpdate) }
  }, [socket, fetchTickets])

  const filteredTickets = tickets.filter(t => {
    if (activeTab === 'chats') return t.channel === 'chat' && t.status === 'open'
    if (activeTab === 'mail') return t.channel === 'mail' && t.status === 'open'
    if (activeTab === 'claimed') return t.status === 'claimed'
    return false
  }).filter(t => {
    if (!search) return true
    const s = search.toLowerCase()
    return (t.customer_name || '').toLowerCase().includes(s) ||
           (t.customer_email || '').toLowerCase().includes(s) ||
           (t.routing_tag || '').toLowerCase().includes(s) ||
           (t.last_message || '').toLowerCase().includes(s)
  })

  const chatCount = tickets.filter(t => t.channel === 'chat' && t.status === 'open').length
  const mailCount = tickets.filter(t => t.channel === 'mail' && t.status === 'open').length
  const claimedCount = tickets.filter(t => t.status === 'claimed').length

  const handleClaim = async (conversationId: string) => {
    try {
      await team.claimTicket(conversationId)
      showToast('✅ Ärendet är nu ditt!', 3000, 'success')
      fetchTickets()
    } catch (err) {
      console.error('Claim failed:', err)
    }
  }

  const tabConfig: { key: InboxTab; label: string; count: number }[] = [
    { key: 'chats', label: 'Live-Chattar', count: chatCount },
    { key: 'mail', label: 'E-post', count: mailCount },
    { key: 'claimed', label: 'Plockade', count: claimedCount },
  ]
  const sectionLabels: Record<InboxTab, string> = { chats: 'LIVE-CHATTAR', mail: 'INKOMNA MAIL', claimed: 'PLOCKADE ÄRENDEN' }

  return (
    <div className="layout-split" id="view-inbox" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            <h2 style={{ margin: 0 }}>Inkorgen</h2>
          </div>
          <div className="header-tabs">
            {tabConfig.map(tab => (
              <button
                key={tab.key}
                className={`header-tab${activeTab === tab.key ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                {tab.count > 0 && <span className="notif-badge-bubble" style={{ marginLeft: 6 }}>{tab.count}</span>}
              </button>
            ))}
          </div>
        </header>

        {/* Section label + search */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 6 }}>
            {sectionLabels[activeTab]}
          </div>
          <input
            type="text"
            placeholder="Sök ärende, namn, stad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)' }}
          />
        </div>

        {/* Ticket list */}
        <div className="ticket-list" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {loading && <div style={{ padding: 30, textAlign: 'center', opacity: 0.5 }}>Laddar...</div>}
          {!loading && filteredTickets.length === 0 && (
            <div style={{ padding: 30, textAlign: 'center', opacity: 0.5, fontStyle: 'italic', fontSize: 13 }}>
              {activeTab === 'chats' ? 'Inga inkomna live-chattar just nu.' : activeTab === 'mail' ? 'Inga inkomna mail-ärenden just nu.' : 'Inga plockade ärenden just nu.'}
            </div>
          )}
          {filteredTickets.map(ticket => (
            <TicketCard
              key={ticket.conversation_id}
              ticket={ticket}
              isActive={selectedTicket === ticket.conversation_id}
              onClick={() => setSelectedTicket(ticket.conversation_id)}
              onClaim={ticket.status === 'open' ? handleClaim : undefined}
            />
          ))}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedTicket ? (
          <div className="hero-placeholder" id="inbox-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
