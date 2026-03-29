import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import 'react-quill-new/dist/quill.snow.css'
import './Templates.css'

const ReactQuill = lazy(() => import('react-quill-new'))
import { templates as templatesApi } from '../services/api'
import { showToast } from '../components/ToastContainer'
import { ADMIN_UI_ICONS } from '../utils/constants'
import type { Template } from '../types'

const QUILL_MODULES = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['link'],
    ['clean'],
  ],
}

const QUILL_FORMATS = [
  'header', 'bold', 'italic', 'underline', 'strike',
  'color', 'background', 'list', 'indent', 'link',
]

export default function Templates() {
  const [templateList, setTemplateList] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [editName, setEditName] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

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

  const selectTemplate = (tpl: Template) => {
    setSelectedTemplate(tpl)
    setEditName(tpl.name)
    setEditSubject(tpl.subject)
    setEditBody(tpl.body)
    setIsEditing(false)
    setIsCreating(false)
  }

  const startNew = () => {
    setSelectedTemplate(null)
    setEditName('')
    setEditSubject('')
    setEditBody('')
    setIsEditing(true)
    setIsCreating(true)
  }

  const startEdit = () => {
    setIsEditing(true)
    setIsCreating(false)
  }

  const cancelEdit = () => {
    if (isCreating) {
      setIsEditing(false)
      setIsCreating(false)
      return
    }
    if (selectedTemplate) {
      setEditName(selectedTemplate.name)
      setEditSubject(selectedTemplate.subject)
      setEditBody(selectedTemplate.body)
    }
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!editName.trim() || !editSubject.trim()) {
      showToast('Namn och ämne krävs.', 3000, 'error')
      return
    }

    setSaving(true)
    try {
      const payload: Partial<Template> = {
        name: editName.trim(),
        subject: editSubject.trim(),
        body: editBody,
      }
      if (selectedTemplate && !isCreating) {
        payload.id = selectedTemplate.id
      }

      await templatesApi.save(payload)
      showToast(isCreating ? 'Mall skapad!' : 'Mall sparad!', 2000, 'success')
      setIsEditing(false)
      setIsCreating(false)
      await fetchTemplates()

      // Re-select the saved template
      if (!isCreating && selectedTemplate) {
        const updated = templateList.find(t => t.id === selectedTemplate.id)
        if (updated) selectTemplate(updated)
      }
    } catch (err) {
      showToast('Kunde inte spara mall.', 3000, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedTemplate) return
    if (!window.confirm(`Radera mallen "${selectedTemplate.name}"?`)) return
    try {
      await templatesApi.delete(selectedTemplate.id)
      showToast('Mall raderad.', 2000, 'success')
      setSelectedTemplate(null)
      setIsEditing(false)
      fetchTemplates()
    } catch (err) {
      showToast('Kunde inte radera mall.', 3000, 'error')
    }
  }

  return (
    <div className="layout-split" id="view-templates" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Mailmallar</h2>
          <div className="header-actions">
            <button className="icon-only-btn" onClick={startNew} title="Ny mall">
              <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.NEW }} />
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
              onClick={() => selectTemplate(tpl)}
            >
              <div className="ticket-card-subject">{tpl.name}</div>
              <div className="ticket-card-preview">{tpl.subject}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedTemplate && !isCreating ? (
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
          <div className="detail-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!isEditing ? (
                  <>
                    <button className="icon-only-btn" onClick={startEdit} title="Redigera">
                      <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.EDIT }} />
                    </button>
                    <button className="icon-only-btn" onClick={handleDelete} title="Radera" style={{ color: '#ff4444' }}>
                      <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.DELETE }} />
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-modal-confirm" onClick={handleSave} disabled={saving} style={{ fontSize: 12 }}>
                      {saving ? 'Sparar...' : 'Spara'}
                    </button>
                    <button className="btn-modal-cancel" onClick={cancelEdit} style={{ fontSize: 12 }}>
                      Avbryt
                    </button>
                  </>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {isCreating ? 'Ny mall' : isEditing ? 'Redigerar' : 'Visar'}
              </span>
            </div>

            {/* Name + Subject */}
            <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
              {isEditing ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Mallnamn</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="ln-input"
                      style={{ width: '100%', marginTop: 2, fontSize: 14, fontWeight: 600 }}
                      placeholder="T.ex. Välkomstmail"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Ämnesrad</label>
                    <input
                      type="text"
                      value={editSubject}
                      onChange={e => setEditSubject(e.target.value)}
                      className="ln-input"
                      style={{ width: '100%', marginTop: 2, fontSize: 13 }}
                      placeholder="Ämne för mailet"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{editName}</h3>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>{editSubject}</p>
                </>
              )}
            </div>

            {/* Quill Editor / Preview */}
            <div style={{ flex: 1, padding: '16px 20px', overflow: 'auto', minHeight: 0 }}>
              {isEditing ? (
                <div className="quill-wrapper" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Suspense fallback={<div className="loading-spinner">Laddar editor...</div>}>
                  <ReactQuill
                    theme="snow"
                    value={editBody}
                    onChange={setEditBody}
                    modules={QUILL_MODULES}
                    formats={QUILL_FORMATS}
                    placeholder="Skriv mallinnehåll..."
                    style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
                  />
                  </Suspense>
                </div>
              ) : (
                <div
                  className="ql-editor"
                  style={{ padding: 0 }}
                  dangerouslySetInnerHTML={{ __html: editBody }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
