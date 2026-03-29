import { useState, useEffect, useRef, useCallback } from 'react'
import './ChatMessages.css'
import './TicketCard.css'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useDataStore } from '../hooks/useDataStore'
import { team } from '../services/api'
import { getAgentStyles, resolveLabel, smartTime, esc } from '../utils/styling'
import { UI_ICONS } from '../utils/constants'
import { showToast } from './ToastContainer'
import NotesModal from './NotesModal'
import AssignModal from './AssignModal'
import type { Ticket, ChatMessage } from '../types'

interface Props {
  conversationId: string
  onArchived?: () => void
  onDeleted?: () => void
}

export default function TicketDetail({ conversationId, onArchived, onDeleted }: Props) {
  const { user: currentUser } = useAuth()
  const { socket } = useSocket()
  const { officeData, usersCache } = useDataStore()
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [replyText, setReplyText] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNotes, setShowNotes] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fetchDetail = useCallback(async () => {
    try {
      const [msgs, inbox] = await Promise.all([
        team.getTicketMessages(conversationId),
        team.fetchInbox(),
      ])
      setMessages(Array.isArray(msgs) ? msgs : [])
      const found = inbox.find((t: Ticket) => t.conversation_id === conversationId)
      setTicket(found || null)
    } catch (err) {
      console.error('Failed to load ticket detail:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Listen for real-time updates
  useEffect(() => {
    if (!socket) return
    const handleReply = (data: { conversation_id: string }) => {
      if (data.conversation_id === conversationId) fetchDetail()
    }
    socket.on('team:customer_reply', handleReply)
    socket.on('team:update', handleReply)
    return () => {
      socket.off('team:customer_reply', handleReply)
      socket.off('team:update', handleReply)
    }
  }, [socket, conversationId, fetchDetail])

  const sendReply = async () => {
    if (!replyText.trim() || !socket) return
    try {
      if (ticket?.channel === 'mail') {
        socket.emit('team:send_email_reply', {
          conversationId,
          message: replyText.trim(),
          agent: currentUser?.username,
        })
      } else {
        socket.emit('team:agent_reply', {
          conversationId,
          message: replyText.trim(),
          agent: currentUser?.username,
        })
      }
      setReplyText('')
      // Optimistically add message
      setMessages(prev => [...prev, { role: 'agent', content: replyText.trim(), timestamp: new Date().toISOString() }])
    } catch (err) {
      showToast('Kunde inte skicka meddelande.', 3000, 'error')
    }
  }

  const handleArchive = async () => {
    if (!window.confirm('Arkivera detta ärende?')) return
    try {
      await team.archiveTicket(conversationId)
      showToast('Ärende arkiverat.', 2000, 'success')
      onArchived?.()
    } catch (err) {
      showToast('Kunde inte arkivera.', 3000, 'error')
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Radera detta ärende permanent?')) return
    try {
      await team.deleteTicket(conversationId)
      showToast('Ärende raderat.', 2000, 'success')
      onDeleted?.()
    } catch (err) {
      showToast('Kunde inte radera.', 3000, 'error')
    }
  }

  const handleClaim = async () => {
    try {
      await team.claimTicket(conversationId)
      showToast('Ärendet är nu ditt!', 2000, 'success')
      fetchDetail()
    } catch (err) {
      showToast('Kunde inte plocka ärende.', 3000, 'error')
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>
  if (!ticket) return <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Ärende hittades inte.</div>

  const styles = getAgentStyles(ticket.routing_tag || ticket.owner, officeData, usersCache, currentUser)
  const label = resolveLabel(ticket.routing_tag, officeData)
  const customerName = ticket.customer_name || ticket.customer_email || 'Anonym'
  const initial = customerName.charAt(0).toUpperCase()

  return (
    <div className="detail-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="detail-header-top" style={{ borderBottom: `2px solid ${styles.main}`, padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Customer avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: '50%', border: `2px solid ${styles.main}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: styles.main, fontWeight: 700, fontSize: 16, background: styles.bubbleBg, flexShrink: 0,
          }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="detail-subject" style={{ margin: 0, fontSize: 15 }}>{esc(customerName)}</h3>
            <div className="header-pills-row" style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <span className="pill" style={{ background: styles.tagBg, color: styles.main }}>{label}</span>
              <span className="pill" style={{ fontSize: 10 }}>
                <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CALENDAR }} /> {smartTime(ticket.created_at)}
              </span>
              {ticket.channel === 'mail' && (
                <span className="pill" style={{ fontSize: 10 }}>
                  <span dangerouslySetInnerHTML={{ __html: UI_ICONS.MAIL }} /> Mail
                </span>
              )}
              {ticket.channel === 'chat' && (
                <span className="pill" style={{ fontSize: 10 }}>
                  <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CHAT }} /> Chatt
                </span>
              )}
              {ticket.owner && (
                <span className="pill" style={{ fontSize: 10 }}>
                  <span dangerouslySetInnerHTML={{ __html: UI_ICONS.AGENT_SMALL }} /> {ticket.owner}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="detail-footer-toolbar" style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {ticket.status === 'open' && (
            <button className="footer-icon-btn" onClick={handleClaim} title="Plocka">
              <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CLAIM }} />
            </button>
          )}
          <button className="footer-icon-btn" onClick={() => setShowAssign(true)} title="Tilldela">
            <span dangerouslySetInnerHTML={{ __html: UI_ICONS.ASSIGN }} />
          </button>
          <button className="footer-icon-btn" onClick={() => setShowNotes(true)} title="Anteckningar">
            <span dangerouslySetInnerHTML={{ __html: UI_ICONS.NOTES }} />
          </button>
          <button className="footer-icon-btn" onClick={handleArchive} title="Arkivera">
            <span dangerouslySetInnerHTML={{ __html: UI_ICONS.ARCHIVE }} />
          </button>
          <button className="footer-icon-btn" onClick={handleDelete} title="Radera" style={{ color: '#ff4444' }}>
            <span dangerouslySetInnerHTML={{ __html: UI_ICONS.TRASH }} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24, fontSize: 13 }}>
            Inga meddelanden ännu.
          </div>
        )}
        {messages.map((msg, i) => {
          const isCustomer = msg.role === 'customer' || msg.role === 'user'
          const isAtlas = msg.role === 'atlas'
          const isAgent = msg.role === 'agent'
          const isSystem = msg.role === 'system'

          return (
            <div key={i} className={`chat-bubble ${isCustomer ? 'user' : 'atlas'}`} style={{ marginBottom: 8 }}>
              {isSystem && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '4px 0' }}>
                  {msg.content}
                </div>
              )}
              {!isSystem && (
                <>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 2 }}>
                    {isCustomer ? customerName : isAtlas ? 'Atlas AI' : isAgent ? (ticket.owner || 'Agent') : msg.role}
                    {msg.timestamp && ` · ${smartTime(msg.timestamp)}`}
                  </div>
                  <div className="bubble-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Reply bar */}
      {ticket.status !== 'closed' && (
        <div className="chat-input-bar" style={{ flexShrink: 0, padding: '12px 20px', borderTop: '1px solid var(--border-color)' }}>
          <textarea
            className="chat-input"
            placeholder={ticket.channel === 'mail' ? 'Skriv ett mailsvar...' : 'Skriv ett meddelande...'}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
            rows={2}
            style={{ resize: 'none' }}
          />
          <button className="send-btn" onClick={sendReply} disabled={!replyText.trim()}>
            <span dangerouslySetInnerHTML={{ __html: UI_ICONS.SEND }} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showNotes && <NotesModal conversationId={conversationId} onClose={() => setShowNotes(false)} />}
      {showAssign && <AssignModal conversationId={conversationId} onClose={() => setShowAssign(false)} onAssigned={fetchDetail} />}
    </div>
  )
}
