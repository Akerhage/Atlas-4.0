import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { connectSocket, disconnectSocket } from '../services/socket'
import { useAuth } from './AuthContext'

interface SocketState {
  socket: Socket | null
  isConnected: boolean
}

const SocketContext = createContext<SocketState>({ socket: null, isConnected: false })

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, isAuthenticated } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || !token) {
      disconnectSocket()
      setSocket(null)
      setIsConnected(false)
      return
    }

    const s = connectSocket(token)
    setSocket(s)

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)

    // If already connected (reconnect scenario)
    if (s.connected) setIsConnected(true)

    return () => {
      s.off('connect', onConnect)
      s.off('disconnect', onDisconnect)
      disconnectSocket()
      setSocket(null)
      setIsConnected(false)
    }
  }, [token, isAuthenticated])

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketState {
  return useContext(SocketContext)
}
