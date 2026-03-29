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
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!socket) return
    const handleReply = (data: { conversation_id: string }) => {
      if (data.conversation_id === conversationId) fetchDetail()
    }
    socket.on('team:customer_reply', handleReply)
    socket.on('team:update', handleReply)
    return () => { socket.off('team:customer_reply', handleReply); socket.off('team:update', handleReply) }
  }, [socket, conversationId, fetchDetail])

  const sendReply = async () => {
    if (!replyText.trim() || !socket) return
    try {
      if (ticket?.channel === 'mail') {
        socket.emit('team:send_email_reply', { conversationId, message: replyText.trim(), agent: currentUser?.username })
      } else {
        socket.emit('team:agent_reply', { conversationId, message: replyText.trim(), agent: currentUser?.username })
      }
      setReplyText('')
      setMessages(prev => [...prev, { role: 'agent', content: replyText.trim(), timestamp: new Date().toISOString() }])
    } catch (err) {
      showToast('Kunde inte skicka meddelande.', 3000, 'error')
    }
  }

  const handleArchive = async () => {
    if (!window.confirm('Arkivera detta ärende?')) return
    try { await team.archiveTicket(conversationId); showToast('Ärende arkiverat.', 2000, 'success'); onArchived?.() } catch { showToast('Kunde inte arkivera.', 3000, 'error') }
  }
  const handleDelete = async () => {
    if (!window.confirm('Radera detta ärende permanent?')) return
    try { await team.deleteTicket(conversationId); showToast('Ärende raderat.', 2000, 'success'); onDeleted?.() } catch { showToast('Kunde inte radera.', 3000, 'error') }
  }
  const handleClaim = async () => {
    try { await team.claimTicket(conversationId); showToast('Ärendet är nu ditt!', 2000, 'success'); fetchDetail() } catch { showToast('Kunde inte plocka ärende.', 3000, 'error') }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', opacity: 0.5 }}>Laddar...</div>
  if (!ticket) return <div style={{ padding: 20, color: 'var(--text-tertiary)' }}>Ärende hittades inte.</div>

  const styles = getAgentStyles(ticket.routing_tag || ticket.owner, officeData, usersCache, currentUser)
  void resolveLabel(ticket.routing_tag, officeData)
  const customerName = ticket.customer_name || ticket.customer_email || 'Anonym'
  const initial = customerName.charAt(0).toUpperCase()
  const isMine = currentUser && ticket.owner === currentUser.username

  return (
    <div className="detail-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', background: `linear-gradient(to bottom, ${styles.bg}, transparent)` }}>
      {/* === HEADER === */}
      <div style={{ borderTop: `3px solid ${styles.main}`, padding: '14px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Customer avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%', background: styles.main,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 18, flexShrink: 0,
            }}>
              {initial}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, color: styles.main }}>{esc(customerName)}</h3>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CALENDAR }} /> {smartTime(ticket.created_at)}
                </span>
                {ticket.channel === 'chat' && (
                  <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CHAT }} /> Chatt
                  </span>
                )}
                {ticket.channel === 'mail' && (
                  <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span dangerouslySetInnerHTML={{ __html: UI_ICONS.MAIL }} /> Mail
                  </span>
                )}
                {(ticket as any).vehicle && (
                  <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span dangerouslySetInnerHTML={{ __html: UI_ICONS.CAR }} /> {(ticket as any).vehicle}
                  </span>
                )}
                {ticket.customer_email && (
                  <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <span dangerouslySetInnerHTML={{ __html: UI_ICONS.MAIL }} /> {ticket.customer_email}
                  </span>
                )}
                {ticket.customer_phone && (
                  <span className="pill" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l2.28-2.28a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg> {ticket.customer_phone}
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Top-right action icons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {ticket.status === 'open' && (
              <button className="action-icon-btn" onClick={handleClaim} title="Plocka" dangerouslySetInnerHTML={{ __html: UI_ICONS.CLAIM }} />
            )}
            <button className="action-icon-btn" onClick={() => setShowAssign(true)} title="Tilldela" dangerouslySetInnerHTML={{ __html: UI_ICONS.ASSIGN }} />
            {!isMine && ticket.owner && (
              <button className="action-icon-btn" onClick={handleClaim} title={`Ta över från ${ticket.owner}`} dangerouslySetInnerHTML={{ __html: UI_ICONS.CLAIM }} />
            )}
            <button className="action-icon-btn" onClick={() => setShowNotes(true)} title="Anteckningar" dangerouslySetInnerHTML={{ __html: UI_ICONS.NOTES }} />
          </div>
        </div>
      </div>

      {/* === MESSAGES === */}
      <div ref={scrollRef} className="inbox-chat-history" style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
        {messages.length === 0 && (
          <div style={{ padding: 40, opacity: 0.5, textAlign: 'center' }}>Ingen historik ännu.</div>
        )}
        {messages.map((msg, i) => {
          const isCustomer = msg.role === 'customer' || msg.role === 'user'
          const isSystem = msg.role === 'system'
          const timeStr = smartTime(msg.timestamp || msg.createdAt || '')
          const senderLabel = isCustomer ? customerName : msg.role === 'atlas' ? 'Atlas' : (ticket.owner || 'Agent')

          if (isSystem) {
            return (
              <div key={i} style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', padding: '8px 0', fontStyle: 'italic' }}>
                {msg.content}
              </div>
            )
          }

          if (isCustomer) {
            // Customer message — left-aligned with colored avatar
            return (
              <div key={i} className="msg-row user" style={{ display: 'flex', width: '100%', marginBottom: 15, justifyContent: 'flex-start' }}>
                <div className="msg-avatar" style={{
                  background: styles.main, color: 'white', width: 36, height: 36,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%', fontWeight: 'bold', marginRight: 12, flexShrink: 0,
                  fontSize: 14,
                }}>
                  {initial}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', maxWidth: '80%' }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, paddingLeft: 2 }}>
                    <b>{senderLabel}</b> · {timeStr}
                  </div>
                  <div className="bubble" style={{
                    background: styles.bubbleBg, border: `1px solid ${styles.border}`,
                    color: 'var(--text-primary)', padding: '12px 15px', borderRadius: 12,
                    lineHeight: 1.5, fontSize: 14,
                  }} dangerouslySetInnerHTML={{ __html: msg.content }} />
                </div>
              </div>
            )
          }

          // Agent/Atlas message — right-aligned with avatar on right
          const isAtlasMsg = msg.role === 'atlas'
          const agentStyles = isAtlasMsg ? null : getAgentStyles(ticket.owner || '', officeData, usersCache, currentUser)
          const avatarBg = isAtlasMsg ? '#3a3a3c' : (agentStyles?.main || '#3a3a3c')
          const avatarContent = isAtlasMsg ? '🤖' : senderLabel.charAt(0).toUpperCase()

          return (
            <div key={i} className="msg-row atlas" style={{ display: 'flex', width: '100%', marginBottom: 15, justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', maxWidth: '80%' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 4, paddingRight: 2 }}>
                  {senderLabel} · {timeStr}
                </div>
                <div className="bubble" style={{
                  background: 'var(--bg-dark-tertiary)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text-primary)', padding: 15, borderRadius: 12,
                }} dangerouslySetInnerHTML={{ __html: msg.content }} />
              </div>
              <div className="msg-avatar" style={{
                background: avatarBg, color: 'white', marginLeft: 12,
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%', flexShrink: 0, fontWeight: 800, fontSize: 18,
              }}>
                {avatarContent}
              </div>
            </div>
          )
        })}
      </div>

      {/* === REPLY BAR === */}
      {ticket.status !== 'closed' && (
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 20px' }}>
            <textarea
              className="chat-input"
              placeholder="Snabbsvar... (Ctrl+Enter)"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendReply() }
              }}
              rows={2}
              style={{ flex: 1, resize: 'none', minHeight: 44 }}
            />
            <button className="send-btn" onClick={sendReply} disabled={!replyText.trim()} style={{ flexShrink: 0 }}>
              <span dangerouslySetInnerHTML={{ __html: UI_ICONS.SEND }} />
            </button>
          </div>
          {/* Bottom action bar */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 20px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', opacity: 0.7 }}>
              Välj mall att kopiera...
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="action-icon-btn" title="Bifoga fil" style={{ opacity: 0.6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              </button>
              <button className="action-icon-btn" title="AI-svar" style={{ opacity: 0.6 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/></svg>
              </button>
              <button className="action-icon-btn" title="Arkivera" onClick={handleArchive} dangerouslySetInnerHTML={{ __html: UI_ICONS.ARCHIVE }} />
              <button className="action-icon-btn" title="Radera" onClick={handleDelete} style={{ color: '#ff4444' }} dangerouslySetInnerHTML={{ __html: UI_ICONS.TRASH }} />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNotes && <NotesModal conversationId={conversationId} onClose={() => setShowNotes(false)} />}
      {showAssign && <AssignModal conversationId={conversationId} onClose={() => setShowAssign(false)} onAssigned={fetchDetail} />}
    </div>
  )
}
