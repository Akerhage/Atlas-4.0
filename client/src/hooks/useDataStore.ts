import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { offices as officesApi, auth as authApi } from '../services/api'
import type { Office, User } from '../types'

interface DataStore {
  officeData: Office[]
  usersCache: User[]
  badges: Record<string, number>
  refreshOffices: () => Promise<void>
  refreshUsers: () => Promise<void>
}

// Singleton state so all components share the same data
let _officeData: Office[] = []
let _usersCache: User[] = []
let _listeners: Set<() => void> = new Set()

function notify() {
  _listeners.forEach(fn => fn())
}

export function useDataStore(): DataStore {
  const { isAuthenticated } = useAuth()
  const { socket } = useSocket()
  const [, forceUpdate] = useState(0)
  const [badges] = useState<Record<string, number>>({})

  useEffect(() => {
    const listener = () => forceUpdate(n => n + 1)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  const refreshOffices = useCallback(async () => {
    try {
      _officeData = await officesApi.getAll()
      notify()
    } catch (err) {
      console.error('Failed to load offices:', err)
    }
  }, [])

  const refreshUsers = useCallback(async () => {
    try {
      _usersCache = await authApi.getUsers()
      notify()
    } catch (err) {
      console.error('Failed to load users:', err)
    }
  }, [])

  // Load on auth
  useEffect(() => {
    if (isAuthenticated) {
      refreshOffices()
      refreshUsers()
    }
  }, [isAuthenticated, refreshOffices, refreshUsers])

  // Listen for badge updates via socket
  useEffect(() => {
    if (!socket) return

    const handleUpdate = () => {
      // Badge counts will be derived from ticket data in views
      // This is a placeholder for the socket-driven badge update
    }

    socket.on('team:update', handleUpdate)
    socket.on('team:new_ticket', handleUpdate)

    return () => {
      socket.off('team:update', handleUpdate)
      socket.off('team:new_ticket', handleUpdate)
    }
  }, [socket])

  return {
    officeData: _officeData,
    usersCache: _usersCache,
    badges,
    refreshOffices,
    refreshUsers,
  }
}
