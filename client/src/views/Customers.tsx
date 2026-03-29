import { useState, useEffect, useCallback } from 'react'
import { customers as customersApi } from '../services/api'

export default function Customers() {
  const [customerList, setCustomerList] = useState<unknown[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null)

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true)
      const data = await customersApi.getAll({ search: search || undefined })
      setCustomerList(data.customers)
      setTotal(data.total)
    } catch (err) {
      console.error('Failed to fetch customers:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    const debounce = setTimeout(fetchCustomers, 300)
    return () => clearTimeout(debounce)
  }, [fetchCustomers])

  return (
    <div className="layout-split" id="view-customers" style={{ display: 'flex' }}>
      <div className="list-panel">
        <header className="chat-header glass-effect">
          <h2>Kunder</h2>
          <div className="header-actions">
            <input
              type="text"
              className="search-input"
              placeholder="Sök kunder..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="result-count">{total} kunder</span>
          </div>
        </header>

        <div className="ticket-list">
          {loading && <div className="loading-spinner">Laddar...</div>}
          {!loading && customerList.length === 0 && (
            <div className="hero-placeholder">
              <div className="hero-content">
                <div className="hero-title">Inga kunder</div>
                <div className="hero-subtitle">
                  {search ? 'Inga resultat matchar din sökning.' : 'Inga kunder registrerade.'}
                </div>
              </div>
            </div>
          )}
          {customerList.map((c: any, i: number) => (
            <div
              key={c.conversation_id || c.id || i}
              className={`team-ticket-card${selectedCustomer === (c.conversation_id || c.id) ? ' selected' : ''}`}
              onClick={() => setSelectedCustomer(c.conversation_id || c.id)}
            >
              <div className="ticket-card-subject">
                {c.customer_name || c.name || c.email || 'Anonym'}
              </div>
              {c.email && <div className="ticket-card-preview">{c.email}</div>}
              {c.phone && <div className="ticket-card-preview">{c.phone}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="detail-panel">
        {!selectedCustomer ? (
          <div className="hero-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="hero-title">Kunder</div>
              <div className="hero-subtitle">Välj en kund för att se historik och detaljer.</div>
            </div>
          </div>
        ) : (
          <div className="detail-content">
            <p style={{ padding: '20px', color: 'var(--text-secondary)' }}>
              Kund: {selectedCustomer}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
