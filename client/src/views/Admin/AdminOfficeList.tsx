import { useState, useEffect } from 'react'
import { offices as officesApi } from '../../services/api'
import { ADMIN_UI_ICONS } from '../../utils/constants'
import type { Office } from '../../types'

interface Props {
  selectedOffice: string | null
  onSelectOffice: (tag: string) => void
  onNewOffice: () => void
}

export default function AdminOfficeList({ selectedOffice, onSelectOffice, onNewOffice }: Props) {
  const [officeList, setOfficeList] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const data = await officesApi.getAll()
        setOfficeList(data)
      } catch (err) {
        console.error('Failed to fetch offices:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchOffices()
  }, [])

  // Group offices by city
  const byCity = officeList.reduce<Record<string, Office[]>>((acc, o) => {
    const city = o.city || 'Övrigt'
    if (!acc[city]) acc[city] = []
    acc[city].push(o)
    return acc
  }, {})

  return (
    <div className="admin-main-list">
      <div className="admin-list-title">
        <span>Kontor ({officeList.length})</span>
        <button className="icon-only-btn" onClick={onNewOffice} title="Nytt kontor">
          <span dangerouslySetInnerHTML={{ __html: ADMIN_UI_ICONS.NEW }} />
        </button>
      </div>
      <div className="admin-list-scroll">
        {loading && <div className="loading-spinner">Laddar...</div>}
        {Object.entries(byCity).sort(([a], [b]) => a.localeCompare(b, 'sv')).map(([city, cityOffices]) => (
          <div key={city} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', padding: '8px 16px 4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {city}
            </div>
            {cityOffices.map(office => {
              const isSelected = selectedOffice === office.routing_tag
              const color = office.office_color || '#0071e3'
              const initial = (office.area || office.name || '?').charAt(0).toUpperCase()

              return (
                <div
                  key={office.routing_tag}
                  className={`admin-mini-card${isSelected ? ' selected' : ''}`}
                  onClick={() => onSelectOffice(office.routing_tag)}
                  style={{ borderLeft: `3px solid ${color}` }}
                >
                  <div
                    className="office-card-bubble"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: `${color}22`,
                      border: `2px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color,
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>
                  <div className="admin-card-info">
                    <span className="admin-card-name">{office.area || office.name}</span>
                    <span className="admin-card-role" style={{ fontSize: 11 }}>{office.routing_tag}</span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
