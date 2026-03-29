import { useState, useEffect, useCallback } from 'react'
import { notes as notesApi } from '../services/api'
import { showToast } from './ToastContainer'
import { ADMIN_UI_ICONS } from '../utils/constants'

interface Note {
  id: number
  content: string
  created_at: string
  author?: string
}

interface Props {
  conversationId: string
  onClose: () => void
}

export default function NotesModal({ conversationId, onClose }: Props) {
  const [noteList, setNoteList] = useState<Note[]>([])
  const [newNote, setNewNote] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchNotes = useCallback(async () => {
    try {
      const data = await notesApi.getForTicket(conversationId) as Note[]
      setNoteList(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const addNote = async () => {
    if (!newNote.trim()) return
    try {
      await notesApi.add(conversationId, newNote.trim())
      setNewNote('')
      fetchNotes()
      showToast('Anteckning sparad.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte spara anteckning.', 3000, 'error')
    }
  }

  const saveEdit = async () => {
    if (editingId === null || !editContent.trim()) return
    try {
      await notesApi.update(editingId, editContent.trim())
      setEditingId(null)
      setEditContent('')
      fetchNotes()
      showToast('Anteckning uppdaterad.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte uppdatera.', 3000, 'error')
    }
  }

  const deleteNote = async (id: number) => {
    if (!window.confirm('Radera denna anteckning?')) return
    try {
      await notesApi.delete(id)
      fetchNotes()
      showToast('Anteckning raderad.', 2000, 'success')
    } catch (err) {
      showToast('Kunde inte radera.', 3000, 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="glass-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 500, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="glass-modal-header">
          <h3>Anteckningar</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <div className="glass-modal-body" style={{ flex: 1, overflowY: 'auto', minHeight: 200 }}>
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && noteList.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: 24, fontSize: 13 }}>
              Inga anteckningar ännu.
            </div>
          )}
          {noteList.map(note => (
            <div key={note.id} className="note-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              {editingId === note.id ? (
                <div>
                  <textarea
                    className="ln-input"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    style={{ width: '100%', minHeight: 60, fontSize: 13, resize: 'vertical' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <button className="btn-modal-confirm" style={{ fontSize: 11, padding: '4px 10px' }} onClick={saveEdit}>
                      Spara
                    </button>
                    <button className="btn-modal-cancel" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => setEditingId(null)}>
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{note.content}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {note.author && `${note.author} · `}
                      {new Date(note.created_at).toLocaleString('sv-SE')}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="icon-only-btn"
                        onClick={() => { setEditingId(note.id); setEditContent(note.content) }}
                        title="Redigera"
                        dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.EDIT }}
                      />
                      <button
                        className="icon-only-btn"
                        onClick={() => deleteNote(note.id)}
                        title="Radera"
                        style={{ color: '#ff4444' }}
                        dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.DELETE }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="glass-modal-footer" style={{ display: 'flex', gap: 8 }}>
          <textarea
            className="ln-input"
            placeholder="Ny anteckning..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addNote() }}
            style={{ flex: 1, minHeight: 36, fontSize: 13, resize: 'none' }}
          />
          <button className="btn-modal-confirm" onClick={addNote} disabled={!newNote.trim()}>
            Spara
          </button>
        </div>
      </div>
    </div>
  )
}
