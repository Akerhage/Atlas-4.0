import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface ThemeState {
  accentColor: string
  setAccentColor: (color: string) => void
  currentTheme: string
  setTheme: (themeName: string) => void
}

const ThemeContext = createContext<ThemeState | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const accentColor = user?.agent_color || '#0071e3'

  // Apply accent color to CSS variable whenever it changes
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-primary', accentColor)
  }, [accentColor])

  const setAccentColor = useCallback((color: string) => {
    document.documentElement.style.setProperty('--accent-primary', color)
  }, [])

  const currentTheme = localStorage.getItem('atlas_theme') || 'atlas-navigator'

  const setTheme = useCallback((themeName: string) => {
    localStorage.setItem('atlas_theme', themeName)
    // Theme stylesheets will be loaded dynamically
    const existing = document.getElementById('theme-stylesheet') as HTMLLinkElement | null
    if (existing) {
      existing.href = `/assets/themes/${themeName}/${themeName}.css`
    } else {
      const link = document.createElement('link')
      link.id = 'theme-stylesheet'
      link.rel = 'stylesheet'
      link.href = `/assets/themes/${themeName}/${themeName}.css`
      document.head.appendChild(link)
    }
  }, [])

  // Load theme on mount
  useEffect(() => {
    setTheme(currentTheme)
  }, [currentTheme, setTheme])

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor, currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
