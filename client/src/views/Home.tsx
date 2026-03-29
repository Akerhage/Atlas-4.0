import { useState, useRef, useEffect, useCallback } from 'react'
import './Home.css'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'
import type { ChatMessage } from '../types'

interface ChatSession {
  id: string
  messages: ChatMessage[]
  isFirstMsg: boolean
  context: { locked_context?: Record<string, unknown> }
}

export default function Home() {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [session, setSession] = useState<ChatSession>(() => ({
    id: `private_${Date.now()}`,
    messages: [],
    isFirstMsg: true,
    context: {},
  }))
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(scrollToBottom, [session.messages])

  // Listen for AI responses
  useEffect(() => {
    if (!socket) return

    const handleAnswer = (data: { answer: string; locked_context?: Record<string, unknown> }) => {
      setIsTyping(false)
      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'atlas', content: data.answer }],
        isFirstMsg: false,
        context: data.locked_context
          ? { ...prev.context, locked_context: data.locked_context }
          : prev.context,
      }))
    }

    const handleError = (err: { message: string }) => {
      setIsTyping(false)
      setSession(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'atlas', content: `⚠️ Serverfel: ${err.message}` }],
      }))
    }

    socket.on('server:answer', handleAnswer)
    socket.on('server:error', handleError)

    return () => {
      socket.off('server:answer', handleAnswer)
      socket.off('server:error', handleError)
    }
  }, [socket])

  const sendMessage = useCallback(() => {
    if (!input.trim() || !socket) return

    const text = input.trim()
    setInput('')
    setIsTyping(true)

    setSession(prev => ({
      ...prev,
      messages: [...prev.messages, { role: 'user', content: text }],
    }))

    socket.emit('client:message', {
      query: text,
      sessionId: session.id,
      isFirstMessage: session.isFirstMsg,
      session_type: 'private',
      context: session.context,
    })
  }, [input, socket, session])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewChat = () => {
    setSession({
      id: `private_${Date.now()}`,
      messages: [],
      isFirstMsg: true,
      context: {},
    })
  }

  return (
    <div className="chat-view" id="view-chat" style={{ display: 'flex' }}>
      <header className="chat-header glass-effect">
        <h2>Hem</h2>
        <div className="header-actions">
          <button className="icon-only-btn" onClick={startNewChat} title="Ny chatt">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5v14" />
            </svg>
          </button>
        </div>
      </header>

      <div className="chat-messages" id="chat-messages">
        {session.messages.length === 0 && (
          <div className="hero-placeholder">
            <div className="hero-content">
              <div className="hero-fg-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="hero-title">Välkommen, {user?.display_name || user?.username}!</div>
              <div className="hero-subtitle">Ställ en fråga till Atlas AI för att komma igång.</div>
            </div>
          </div>
        )}

        {session.messages.map((msg, i) => (
          <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'atlas'}`}>
            <div className="bubble-content" dangerouslySetInnerHTML={{ __html: msg.content }} />
          </div>
        ))}

        {isTyping && (
          <div className="chat-bubble atlas">
            <div className="bubble-content typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-input-bar">
        <textarea
          className="chat-input"
          placeholder="Skriv ett meddelande..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />
        <button className="send-btn" onClick={sendMessage} disabled={!input.trim()}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3.714 3.048a.498.498 0 0 0-.683.627l2.843 7.627a2 2 0 0 1 0 1.396l-2.842 7.627a.498.498 0 0 0 .682.627l18-8.5a.5.5 0 0 0 0-.904z" />
            <path d="M6 12h16" />
          </svg>
        </button>
      </footer>
    </div>
  )
}
