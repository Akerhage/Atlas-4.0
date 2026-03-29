import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import { ATLAS_VERSION } from '../utils/constants'

export default function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggningen misslyckades')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ln-overlay" style={{ display: 'flex' }}>
      <div className="ln-blob ln-blob1" />
      <div className="ln-blob ln-blob2" />
      <div className="ln-card">
        <div className="ln-card-glow" />
        <div className="ln-logo-wrap">
          <div className="ln-ring-pulse" />
          <div className="ln-ring-pulse ln-delay" />
          <div className="ln-ring-spin" />
          <div className="ln-logo-circle">
            <img
              src="/assets/images/logo.png"
              className="ln-logo-img"
              alt="Atlas"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
                const fb = (e.target as HTMLImageElement).parentNode?.querySelector('.ln-logo-fallback') as HTMLElement
                if (fb) fb.style.display = 'flex'
              }}
            />
            <span className="ln-logo-fallback">A</span>
          </div>
        </div>
        <p className="ln-app-name">ATLAS</p>
        <p className="ln-tagline">Support &amp; Ärendehantering</p>
        <div className="ln-divider" />
        <form className="ln-form" onSubmit={handleSubmit}>
          <div className="ln-field">
            <svg className="ln-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <input
              type="text"
              className="ln-input"
              placeholder="Användarnamn"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="ln-field">
            <svg className="ln-field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              type="password"
              className="ln-input"
              placeholder="Lösenord"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="ln-error">{error}</p>}
          <button type="submit" className="ln-btn" disabled={loading}>
            <span className="ln-btn-shimmer" />
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
        <p className="ln-version">v{ATLAS_VERSION} &mdash; Atlas Support</p>
        <div className="ln-dots">
          <span className="ln-dot ln-red" />
          <span className="ln-dot ln-yellow" />
          <span className="ln-dot ln-green" />
        </div>
      </div>
    </div>
  )
}
