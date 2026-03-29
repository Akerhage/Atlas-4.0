import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { User } from '../types'
import { auth } from '../services/api'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (updates: Partial<User>) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('atlas_token')
  )
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('atlas_user')
    return stored ? JSON.parse(stored) : null
  })

  // Auto-logout on token expiry
  useEffect(() => {
    if (!token) return

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000)
        if (payload.exp < now) {
          logout()
          return
        }
        const timeUntilExpiry = (payload.exp * 1000) - Date.now()
        const timer = setTimeout(() => {
          alert('Sessionen har gått ut.')
          logout()
        }, timeUntilExpiry)
        return () => clearTimeout(timer)
      }
    } catch {
      // Invalid token format
    }
  }, [token])

  const login = useCallback(async (username: string, password: string) => {
    const result = await auth.login(username, password)
    localStorage.setItem('atlas_token', result.token)
    localStorage.setItem('atlas_user', JSON.stringify(result.user))
    setToken(result.token)
    setUser(result.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('atlas_token')
    localStorage.removeItem('atlas_user')
    setToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updates: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null
      const updated = { ...prev, ...updates }
      localStorage.setItem('atlas_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      token,
      user,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
