import { useState } from 'react'
import { useDataStore } from '../../hooks/useDataStore'
import { showToast } from '../../components/ToastContainer'

interface Props {
  onDirtyChange: (dirty: boolean) => void
  onSaved: (tag: string) => void
  onCancel: () => void
}

export default function AdminOfficeForm({ onDirtyChange, onSaved, onCancel }: Props) {
  const { refreshOffices } = useDataStore()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [routingTag, setRoutingTag] = useState('')
  const [color, setColor] = useState('#0071e3')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)

  const markDirty = () => onDirtyChange(true)

  // Auto-generate routing tag from city + area
  const generateTag = (c: string, a: string) => {
    const parts = [c, a].filter(Boolean).map(s => s.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    return parts.join('_')
  }

  const handleSave = async () => {
    if (!name.trim() || !city.trim()) {
      showToast('Namn och stad krävs.', 3000, 'error')
      return
    }

    const tag = routingTag.trim() || generateTag(city, area)
    if (!tag) {
      showToast('Routing-tag kunde inte genereras.', 3000, 'error')
      return
    }

    setSaving(true)
    try {
      await fetch('/api/admin/offices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('atlas_token')}`,
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({
          name: name.trim(),
          city: city.trim(),
          area: area.trim(),
          routing_tag: tag,
          office_color: color,
          phone: phone.trim(),
          email: email.trim(),
        }),
      })
      showToast('Kontor skapat!', 3000, 'success')
      refreshOffices()
      onSaved(tag)
    } catch (err) {
      showToast('Kunde inte skapa kontor.', 3000, 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin-detail-content" style={{ overflowY: 'auto' }}>
      <div
        style={{
          background: `linear-gradient(135deg, ${color}22, transparent)`,
          borderBottom: `2px solid ${color}`,
          padding: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Nytt kontor</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-modal-confirm" onClick={handleSave} disabled={saving}>
            {saving ? 'Sparar...' : 'Spara'}
          </button>
          <button className="btn-modal-cancel" onClick={onCancel}>Avbryt</button>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Kontorsnamn *</label>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="T.ex. MDA Göteborg Ullevi" />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Stad *</label>
            <input type="text" value={city} onChange={(e) => { setCity(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="T.ex. Göteborg" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Område/Area</label>
            <input type="text" value={area} onChange={(e) => { setArea(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="T.ex. Ullevi" />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Routing-tag (auto-genereras)</label>
            <input type="text" value={routingTag || generateTag(city, area)} onChange={(e) => { setRoutingTag(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} placeholder="t.ex. goteborg_ullevi" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Färg</label>
            <input type="color" value={color} onChange={(e) => { setColor(e.target.value); markDirty() }} style={{ width: '100%', height: 36, marginTop: 4, border: 'none', cursor: 'pointer' }} />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Telefon</label>
            <input type="text" value={phone} onChange={(e) => { setPhone(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div>
            <label style={{ color: 'var(--text-secondary)', fontSize: 12 }}>E-post</label>
            <input type="text" value={email} onChange={(e) => { setEmail(e.target.value); markDirty() }} className="ln-input" style={{ width: '100%', marginTop: 4 }} />
          </div>
        </div>
      </div>
    </div>
  )
}
