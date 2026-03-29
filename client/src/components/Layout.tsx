import { useState, useCallback, type ReactNode } from 'react'
import Sidebar from './Sidebar'
import ToastContainer from './ToastContainer'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMenu = useCallback(() => setMobileMenuOpen(prev => !prev), [])
  const closeMenu = useCallback(() => setMobileMenuOpen(false), [])

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Mobile hamburger button */}
      <button
        className="mobile-hamburger-btn"
        onClick={toggleMenu}
        aria-label="Öppna meny"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileMenuOpen ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div className="mobile-overlay" onClick={closeMenu} />
      )}

      <div
        className={`sidebar-wrapper${mobileMenuOpen ? ' mobile-open' : ''}`}
        style={{ width: 260, minWidth: 260, flexShrink: 0 }}
      >
        <Sidebar />
      </div>

      <main className="main-content-area" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={closeMenu}>
        {children}
      </main>
      <ToastContainer />
    </div>
  )
}
