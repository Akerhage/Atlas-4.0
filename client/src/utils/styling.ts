// ============================================
// Styling Utilities
// Direct port of modules/styling-utils.js
// ============================================
// ⚠️ CRITICAL: getAgentStyles() is the ONLY source of color objects in Atlas.
// Priority: office_color → agent_color (usersCache) → currentUser → fallback
// Output keys: main, bg, tagBg, bubbleBg, border — ALL views depend on these exact names.

import type { AgentStyles, Office, User } from '../types'

const FALLBACK_HEX = '#b8955a'

function hexToRgba(hex: string, alpha: number): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  } catch {
    return `rgba(0, 113, 227, ${alpha})`
  }
}

function makeStyles(hex: string): AgentStyles {
  return {
    main: hex,
    bg: hexToRgba(hex, 0.08),
    tagBg: hexToRgba(hex, 0.2),
    bubbleBg: hexToRgba(hex, 0.12),
    border: hexToRgba(hex, 0.3),
  }
}

export function getAgentStyles(
  tag: string | null | undefined,
  officeData: Office[],
  usersCache: User[],
  currentUser: User | null,
): AgentStyles {
  if (!tag || tag.toLowerCase() === 'unclaimed') {
    return { ...makeStyles(FALLBACK_HEX), main: '#ff4444', bg: 'rgba(255, 68, 68, 0.08)' }
  }

  // Priority: office → usersCache → currentUser → fallback
  const office = officeData.find(o => o.routing_tag === tag.toLowerCase())
  let hex = FALLBACK_HEX

  if (office) {
    hex = office.office_color
  } else {
    const u = usersCache.find(u => u.username === tag)
    hex = u?.agent_color
      || (tag === currentUser?.username ? (currentUser?.agent_color || FALLBACK_HEX) : FALLBACK_HEX)
  }

  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) hex = FALLBACK_HEX

  return makeStyles(hex)
}

// Short label for ticket cards (e.g. "M-CITY", "V-Hamnen")
export function resolveLabel(tag: string | null | undefined, officeData: Office[]): string {
  const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag))
  if (!office) return tag ? tag.toUpperCase() : 'ÄRENDE'

  const city = office.city || ''
  const area = office.area || ''

  if (area.toUpperCase() === 'CITY') {
    if (city.toUpperCase().includes('MALMÖ')) return 'M-CITY'
    if (city.toUpperCase().includes('STOCKHOLM')) return 'S-CITY'
  }

  let finalLabel = area || city
  if (finalLabel.toUpperCase().startsWith('VÄSTRA ')) {
    finalLabel = 'V-' + finalLabel.substring(7)
  }

  return finalLabel.toUpperCase()
}

export function formatName(tag: string | null | undefined, officeData: Office[]): string {
  const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag))
  if (office) return office.name
  return tag ? tag.charAt(0).toUpperCase() + tag.slice(1) : ''
}

export function getCityFromOwner(tag: string | null | undefined, officeData: Office[]): string {
  const office = officeData.find(o => o.routing_tag === (tag ? tag.toLowerCase() : tag))
  return office ? office.city : 'Support'
}

// Format timestamp: same day → "HH:MM", other day → "YYYY-MM-DD HH:MM"
export function smartTime(ts: string | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const t = d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? t : d.toLocaleDateString('sv-SE') + ' ' + t
}

// Strip HTML tags to plain text, truncated
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  const tmp = document.createElement('DIV')
  tmp.innerHTML = html
  const text = tmp.textContent || tmp.innerText || ''
  return text.length > 60 ? text.substring(0, 60) + '...' : text
}

// XSS escape for rendering user content
export function esc(str: string | null | undefined): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
