import { useState, useRef, useEffect } from 'react'
import { useRoom } from '../context/RoomContext'

export default function Chat({ roomId, user, onChatViolation }) {
  const { messages, addMessage, addWarning } = useRoom()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const chatWsRef = useRef(null)

  useEffect(() => {
    // Connect to chat WebSocket
    const ws = new WebSocket(`ws://localhost:8000/ws/chat/${roomId}`)
    chatWsRef.current = ws

    ws.onopen = () => {
      console.log('[Chat] ✅ Connected to chat server')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[Chat] Received:', data.type, data)
        
        if (data.type === 'chat_message' && data.userId !== user.id) {
          addMessage({
            id: Date.now().toString(),
            userId: data.userId,
            userName: data.userName,
            text: data.text,
            isOwn: false
          })
        } else if (data.type === 'moderation_warning') {
          console.log('[Chat] 🚨 CHAT VIOLATION! Strike:', data.strike)
          
          // Show warning overlay for the violator
          if (data.strike) {
            addWarning({
              id: Date.now().toString(),
              userId: user.id,
              userName: data.userName || user.name,
              reason: `💬 ${data.reason}`,
              severity: data.severity || 'medium',
              strike: data.strike,
              source: 'chat'
            })
            
            // Callback to update strike count in Room
            if (onChatViolation) {
              onChatViolation(data.strike)
            }
          }
          
          // Also show system message in chat
          addMessage({
            id: Date.now().toString(),
            isSystem: true,
            text: `⚠️ ${data.userName || 'You'} received a warning: ${data.reason}`
          })
        }
      } catch (e) {
        console.error('[Chat] Message parse error:', e)
      }
    }

    ws.onclose = () => {
      console.log('[Chat] Disconnected')
    }

    return () => {
      ws.close()
    }
  }, [roomId, user.id, addMessage])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const message = {
      type: 'chat_message',
      userId: user.id,
      userName: user.name,
      text: input.trim()
    }

    // Send to chat server (which also monitors)
    if (chatWsRef.current?.readyState === WebSocket.OPEN) {
      chatWsRef.current.send(JSON.stringify(message))
    }

    // Add to local messages
    addMessage({
      id: Date.now().toString(),
      userId: user.id,
      userName: user.name,
      text: input.trim(),
      isOwn: true
    })

    setInput('')
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* Header */}
      <div className="h-14 border-b border-slate-700 flex items-center px-4">
        <h2 className="font-medium">Chat</h2>
        <span className="ml-2 text-xs text-gray-500">AI-monitored</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            No messages yet
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.isSystem ? (
              <div className="text-center">
                <span className="text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full">
                  {msg.text}
                </span>
              </div>
            ) : (
              <div className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-gray-400">
                    {msg.isOwn ? 'You' : msg.userName}
                  </span>
                  <span className="text-xs text-gray-600">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
                  msg.isOwn 
                    ? 'bg-blue-600 rounded-br-md' 
                    : 'bg-slate-700 rounded-bl-md'
                }`}>
                  <p className="text-sm break-words">{msg.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-full focus:outline-none focus:border-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Messages are monitored for policy compliance
        </p>
      </form>
    </>
  )
}
