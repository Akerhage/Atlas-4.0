import { useAuth } from '../context/AuthContext'
import { useDataStore } from '../hooks/useDataStore'
import { getAgentStyles, resolveLabel, stripHtml } from '../utils/styling'
import { UI_ICONS } from '../utils/constants'
import type { Ticket } from '../types'

interface Props {
  ticket: Ticket
  isActive?: boolean
  onClick: () => void
  onClaim?: (id: string) => void
}

function resolveTicketTitle(t: Ticket): string {
  return t.customer_name || t.customer_email || t.subject || 'Anonym'
}

export default function TicketCard({ ticket, isActive, onClick, onClaim }: Props) {
  const { user } = useAuth()
  const { officeData, usersCache } = useDataStore()

  const t = ticket
  const isInternal = (t.channel as string) === 'internal'
  const isMail = t.channel === 'mail'
  const styles = isInternal
    ? { main: '#f1c40f', bg: 'transparent', tagBg: 'rgba(241,196,15,0.2)', bubbleBg: 'rgba(241,196,15,0.15)', border: 'rgba(241,196,15,0.3)' }
    : getAgentStyles(t.routing_tag || t.owner, officeData, usersCache, user)

  const tagText = t.routing_tag
    ? resolveLabel(t.routing_tag, officeData)
    : (t.owner ? resolveLabel(t.owner, officeData) : (isMail ? 'MAIL' : 'CHATT'))

  const typeIcon = isMail ? UI_ICONS.MAIL : UI_ICONS.CHAT
  const displayTitle = resolveTicketTitle(t)

  const rawPreview = t.last_message || ''
  const previewText = stripHtml(rawPreview)

  const ts = t.updated_at || t.created_at
  const date = ts ? new Date(ts) : new Date()
  const timeStr = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  const dateStr = date.toLocaleDateString('sv-SE')

  return (
    <div
      className={`team-ticket-card${isActive ? ' active-ticket' : ''}${isInternal ? ' internal-ticket' : ''}`}
      style={{ borderLeft: `4px solid ${styles.main}`, ['--agent-color' as string]: styles.main }}
      onClick={onClick}
    >
      <div className="ticket-header-row">
        <div className="ticket-title">
          <span style={{ opacity: 0.7, marginRight: 6, display: 'flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: typeIcon }} />
          <span style={{ color: styles.main, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {displayTitle}
          </span>
        </div>
        <div className="ticket-top-right">
          <button
            className="notes-trigger-btn"
            title="Anteckningar"
            style={{ color: styles.main, background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
            onClick={(e) => e.stopPropagation()}
            dangerouslySetInnerHTML={{ __html: UI_ICONS.NOTES }}
          />
        </div>
      </div>

      <div className="ticket-preview">{previewText}</div>

      <div className="ticket-footer-bar">
        <div className="ticket-time">{dateStr} • {timeStr}</div>
        <div className="ticket-tag" style={{ color: styles.main }}>{tagText}</div>
      </div>

      {onClaim && !t.owner && (
        <button
          className="claim-mini-btn claim-action"
          title="Ta ärendet"
          style={{ color: styles.main }}
          onClick={(e) => { e.stopPropagation(); onClaim(t.conversation_id) }}
          dangerouslySetInnerHTML={{ __html: UI_ICONS.CLAIM }}
        />
      )}
    </div>
  )
}
