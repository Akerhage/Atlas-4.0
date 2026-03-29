import { useState, useEffect } from 'react'
import { showToast } from '../../components/ToastContainer'

interface GapEntry {
  id: number
  query: string
  count: number
  ts_resolved: boolean
  ts_attempted: boolean
  last_seen: string
}

export default function AdminGaps() {
  const [gaps, setGaps] = useState<GapEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [analyzingAll, setAnalyzingAll] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<number, string>>({})
  const [overallAnalysis, setOverallAnalysis] = useState<string | null>(null)

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
    'ngrok-skip-browser-warning': 'true',
  }

  useEffect(() => {
    fetchGaps()
  }, [])

  const fetchGaps = async () => {
    try {
      const res = await fetch('/api/admin/rag-failures', { headers })
      const data = await res.json()
      setGaps(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch gaps:', err)
    } finally {
      setLoading(false)
    }
  }

  const analyzeSingle = async (gap: GapEntry) => {
    setAnalyzingId(gap.id)
    try {
      const res = await fetch('/api/admin/analyze-gap-single', {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: gap.query }),
      })
      const data = await res.json()
      setSuggestions(prev => ({ ...prev, [gap.id]: data.suggestion || data.analysis || 'Ingen analys tillgänglig.' }))
    } catch (err) {
      showToast('AI-analys misslyckades.', 3000, 'error')
    } finally {
      setAnalyzingId(null)
    }
  }

  const analyzeAll = async () => {
    setAnalyzingAll(true)
    try {
      const res = await fetch('/api/admin/analyze-gaps', {
        method: 'POST',
        headers,
        body: JSON.stringify({ queries: gaps.map(g => g.query) }),
      })
      const data = await res.json()
      setOverallAnalysis(data.analysis || 'Ingen analys tillgänglig.')
    } catch (err) {
      showToast('Samlad AI-analys misslyckades.', 3000, 'error')
    } finally {
      setAnalyzingAll(false)
    }
  }

  const clearAll = async () => {
    if (!window.confirm('Radera ALLA kunskapsluckor? Detta kan inte ångras.')) return
    try {
      await fetch('/api/admin/rag-failures', { method: 'DELETE', headers })
      setGaps([])
      setSuggestions({})
      setOverallAnalysis(null)
      showToast('Alla luckor raderade.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte radera.', 3000, 'error')
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>

  const last7Days = gaps.filter(g => {
    const d = new Date(g.last_seen)
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000
  })
  const tsSolved = gaps.filter(g => g.ts_resolved).length

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: 'var(--text-primary)' }}>Kunskapsluckor</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-glass-small"
              onClick={analyzeAll}
              disabled={analyzingAll || gaps.length === 0}
              style={{ fontSize: 12 }}
            >
              {analyzingAll ? 'Analyserar...' : '🤖 Analysera alla'}
            </button>
            <button
              className="btn-glass-small"
              onClick={clearAll}
              disabled={gaps.length === 0}
              style={{ fontSize: 12, color: '#ff4444' }}
            >
              Rensa alla
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          <div style={{ padding: 12, background: 'var(--bg-dark-secondary)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>{gaps.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Totalt</div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-dark-secondary)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#f1c40f' }}>{last7Days.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Senaste 7 dagar</div>
          </div>
          <div style={{ padding: 12, background: 'var(--bg-dark-secondary)', borderRadius: 8, textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#2ecc71' }}>
              {gaps.length > 0 ? Math.round((tsSolved / gaps.length) * 100) : 0}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Löst via TS</div>
          </div>
        </div>

        {/* Overall analysis */}
        {overallAnalysis && (
          <div style={{ padding: 16, background: 'var(--bg-dark-secondary)', borderRadius: 8, marginBottom: 20, borderLeft: '3px solid var(--accent-primary)' }}>
            <h4 style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>Samlad AI-analys</h4>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{overallAnalysis}</div>
          </div>
        )}

        {/* Gap list */}
        {gaps.length === 0 && (
          <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 40 }}>
            Inga kunskapsluckor registrerade.
          </div>
        )}
        {gaps.sort((a, b) => b.count - a.count).map(gap => (
          <div
            key={gap.id}
            style={{
              marginBottom: 10,
              padding: '12px 16px',
              background: 'var(--bg-dark-secondary)',
              borderRadius: 8,
              borderLeft: `3px solid ${gap.ts_resolved ? '#2ecc71' : gap.ts_attempted ? '#f1c40f' : '#ff4444'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{gap.query}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="pill" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {gap.count}x
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {gap.ts_resolved ? '✓ Löst via TS' : gap.ts_attempted ? '✗ TS försökt' : '— Ej testat'}
                  </span>
                </div>
              </div>
              <button
                className="btn-glass-small gap-ai-btn"
                onClick={() => analyzeSingle(gap)}
                disabled={analyzingId === gap.id}
                style={{ fontSize: 11, flexShrink: 0 }}
              >
                {analyzingId === gap.id ? '...' : '🤖 Analysera'}
              </button>
            </div>
            {suggestions[gap.id] && (
              <div style={{ marginTop: 10, padding: 12, background: 'rgba(0,113,227,0.08)', borderRadius: 6 }}>
                <div style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {suggestions[gap.id]}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
