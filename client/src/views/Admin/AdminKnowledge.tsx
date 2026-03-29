import { useState, useEffect } from 'react'
import { showToast } from '../../components/ToastContainer'

interface KBSection {
  title: string
  answer: string
  keywords?: string[]
}

interface KBFile {
  filename: string
  title?: string
}

export default function AdminKnowledge() {
  const [files, setFiles] = useState<KBFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [sections, setSections] = useState<KBSection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [unlockedSections, setUnlockedSections] = useState<Set<number>>(new Set())

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
    'ngrok-skip-browser-warning': 'true',
  }

  useEffect(() => {
    fetch('/api/admin/basfakta-list', { headers })
      .then(r => r.json())
      .then(data => setFiles(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const loadFile = async (filename: string) => {
    setSelectedFile(filename)
    setUnlockedSections(new Set())
    try {
      const res = await fetch(`/api/admin/basfakta/${filename}`, { headers })
      const data = await res.json()
      setSections(Array.isArray(data.sections) ? data.sections : [])
    } catch (err) {
      console.error('Failed to load KB file:', err)
      setSections([])
    }
  }

  const toggleSectionLock = (idx: number) => {
    setUnlockedSections(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const updateSection = (idx: number, field: 'title' | 'answer', value: string) => {
    setSections(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
  }

  const addSection = () => {
    setSections(prev => [...prev, { title: '', answer: '', keywords: [] }])
    setUnlockedSections(prev => new Set([...prev, sections.length]))
  }

  const deleteSection = (idx: number) => {
    if (!window.confirm('Radera denna sektion?')) return
    setSections(prev => prev.filter((_, i) => i !== idx))
    setUnlockedSections(prev => {
      const next = new Set<number>()
      prev.forEach(i => { if (i < idx) next.add(i); else if (i > idx) next.add(i - 1) })
      return next
    })
  }

  const saveFile = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      await fetch(`/api/admin/basfakta/${selectedFile}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ sections }),
      })
      showToast('Kunskapsfil sparad!', 2000, 'success')
      setUnlockedSections(new Set())
    } catch (err) {
      showToast('Kunde inte spara.', 3000, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-spinner" style={{ padding: 40 }}>Laddar...</div>

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div style={{ padding: 20 }}>
        <h3 style={{ color: 'var(--text-primary)', marginBottom: 16 }}>Kunskapsbas</h3>

        {/* File list */}
        {!selectedFile && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map(f => (
              <div
                key={f.filename}
                className="admin-mini-card"
                onClick={() => loadFile(f.filename)}
                style={{ cursor: 'pointer' }}
              >
                <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>📄</span>
                <span className="admin-card-name" style={{ fontSize: 13 }}>
                  {f.title || f.filename.replace('.json', '').replace('basfakta_', '')}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Section editor */}
        {selectedFile && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <button
                className="btn-glass-small"
                onClick={() => { setSelectedFile(null); setSections([]) }}
                style={{ fontSize: 12 }}
              >
                ← Tillbaka
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-glass-small" onClick={addSection} style={{ fontSize: 12 }}>
                  + Ny sektion
                </button>
                <button className="btn-modal-confirm" onClick={saveFile} disabled={saving}>
                  {saving ? 'Sparar...' : 'Spara fil'}
                </button>
              </div>
            </div>

            <h4 style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
              {selectedFile.replace('.json', '').replace('basfakta_', '')} ({sections.length} sektioner)
            </h4>

            {sections.map((section, idx) => {
              const isUnlocked = unlockedSections.has(idx)
              return (
                <div
                  key={idx}
                  className="admin-kb-section-card"
                  style={{
                    marginBottom: 12,
                    padding: 16,
                    background: 'var(--bg-dark-secondary)',
                    borderRadius: 8,
                    borderLeft: `3px solid var(--accent-primary)`,
                    opacity: isUnlocked ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Sektion {idx + 1}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="admin-lock-btn" onClick={() => toggleSectionLock(idx)} style={{ fontSize: 11 }}>
                        {isUnlocked ? 'Lås' : 'Lås upp'}
                      </button>
                      {isUnlocked && (
                        <button
                          onClick={() => deleteSection(idx)}
                          style={{ background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: 12 }}
                        >
                          Radera
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Titel</label>
                    <input
                      type="text"
                      value={section.title}
                      onChange={(e) => updateSection(idx, 'title', e.target.value)}
                      disabled={!isUnlocked}
                      className="ln-input"
                      style={{ width: '100%', marginTop: 2, fontSize: 13 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Svar</label>
                    <textarea
                      value={section.answer}
                      onChange={(e) => updateSection(idx, 'answer', e.target.value)}
                      disabled={!isUnlocked}
                      className="ln-input"
                      style={{ width: '100%', marginTop: 2, fontSize: 13, minHeight: 80, resize: 'vertical' }}
                    />
                  </div>
                  {section.keywords && section.keywords.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                      {section.keywords.map((kw, ki) => (
                        <span key={ki} className="kw-pill pill" style={{ fontSize: 10, padding: '2px 6px' }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
