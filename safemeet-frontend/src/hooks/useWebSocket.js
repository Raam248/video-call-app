import { useState, useEffect, useRef, useCallback } from 'react'
import { useRoom } from '../context/RoomContext'

export default function useWebSocket(roomId, user) {
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const { addParticipant, removeParticipant, setIsConnected: setContextConnected } = useRoom()

  const connect = useCallback(() => {
    if (!roomId || !user?.id) return

    const ws = new WebSocket(`ws://localhost:8000/ws/room/${roomId}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Room WebSocket connected')
      setIsConnected(true)
      setContextConnected(true)

      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        userId: user.id,
        userName: user.name,
        isHost: user.isHost
      }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[Room WS] Received:', data.type, data)
        
        switch (data.type) {
          case 'user_joined':
            console.log(`[Room] User joined: ${data.userName}`)
            if (data.userId !== user.id) {
              addParticipant({
                id: data.userId,
                name: data.userName,
                isHost: data.isHost
              })
            }
            break

          case 'user_left':
            console.log(`[Room] User left: ${data.userId}`)
            removeParticipant(data.userId)
            break

          case 'room_state':
            console.log(`[Room] Room state - ${data.participants?.length || 0} existing participants`)
            data.participants?.forEach(p => {
              if (p.id !== user.id) {
                addParticipant(p)
              }
            })
            break

          case 'moderation_alert':
            console.log('[Room] ⚠️ Moderation alert:', data.userName, data.reason)
            break

          case 'user_kicked':
            if (data.userId === user.id) {
              // Current user was kicked
              alert(`You have been removed from the meeting: ${data.reason}`)
              window.location.href = '/'
            } else {
              removeParticipant(data.userId)
            }
            break

          default:
            console.log('Unknown message type:', data.type)
        }
      } catch (e) {
        console.error('WebSocket message parse error:', e)
      }
    }

    ws.onclose = (e) => {
      console.log('[Room WS] Disconnected - code:', e.code, 'reason:', e.reason)
      setIsConnected(false)
      setContextConnected(false)

      // Attempt reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[Room WS] Attempting reconnection...')
        connect()
      }, 3000)
    }

    ws.onerror = (error) => {
      console.error('[Room WS] ❌ Connection error - is backend running on port 8000?', error)
    }
  }, [roomId, user, addParticipant, removeParticipant, setContextConnected])

  useEffect(() => {
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [connect])

  const sendMessage = useCallback((message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  return {
    isConnected,
    sendMessage
  }
}
