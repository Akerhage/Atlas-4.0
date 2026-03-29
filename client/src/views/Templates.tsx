import { useState, useEffect, useCallback } from 'react'
import { templates as templatesApi } from '../services/api'
import type { Template } from '../types'

export default function Templates() {
  const [templateList, setTemplateList] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await templatesApi.getAll()
      setTemplateList(data)
    } catch (err) {
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  return (
    <div className="layout-split" id="view-templates" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Mailmallar</h2>
          <div className="header-actions">
            <button className="icon-only-btn" title="Ny mall">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5v14" />
              </svg>
            </button>
          </div>
        </header>

        <div className="ticket-list">
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && templateList.length === 0 && (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-title">Inga mallar</div>
                <div className="hero-subtitle">Skapa din första mailmall.</div>
              </div>
            </div>
          )}
          {templateList.map(tpl => (
            <div
              key={tpl.id}
              className={`team-ticket-card${selectedTemplate?.id === tpl.id ? ' selected' : ''}`}
              onClick={() => setSelectedTemplate(tpl)}
            >
              <div className="ticket-card-subject">{tpl.name}</div>
              <div className="ticket-card-preview">{tpl.subject}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedTemplate ? (
          <div className="hero-placeholder" id="editor-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
              <div className="hero-title">Mailmallar</div>
              <div className="hero-subtitle">Välj en mall i listan för att redigera eller skapa en ny.</div>
            </div>
          </div>
        ) : (
          <div className="detail-content" style={{ padding: '20px' }}>
            <h3>{selectedTemplate.name}</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {selectedTemplate.subject}
            </p>
            <div dangerouslySetInnerHTML={{ __html: selectedTemplate.body }} />
          </div>
        )}
      </div>
    </div>
  )
}
