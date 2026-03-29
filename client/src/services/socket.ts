// ============================================
// Socket.IO Client Service
// ============================================
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(token: string): Socket {
  if (socket?.connected) return socket

  const serverUrl = import.meta.env.DEV ? 'http://localhost:3001' : window.location.origin

  socket = io(serverUrl, {
    auth: { token },
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  })

  return socket
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket(): Socket | null {
  return socket
}
