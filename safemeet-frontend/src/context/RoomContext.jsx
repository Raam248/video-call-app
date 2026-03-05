import { createContext, useContext, useState, useCallback } from 'react'

const RoomContext = createContext()

export function RoomProvider({ children }) {
  const [user, setUser] = useState({
    id: null,
    name: '',
    isHost: false
  })
  const [roomInfo, setRoomInfo] = useState(null)
  const [participants, setParticipants] = useState([])
  const [messages, setMessages] = useState([])
  const [warnings, setWarnings] = useState([])
  const [isConnected, setIsConnected] = useState(false)

  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, { ...message, timestamp: new Date() }])
  }, [])

  const addWarning = useCallback((warning) => {
    setWarnings(prev => [...prev, { ...warning, timestamp: new Date() }])
    // Auto-remove warning after 10 seconds
    setTimeout(() => {
      setWarnings(prev => prev.filter(w => w.id !== warning.id))
    }, 10000)
  }, [])

  const addParticipant = useCallback((participant) => {
    setParticipants(prev => {
      if (prev.find(p => p.id === participant.id)) return prev
      return [...prev, participant]
    })
  }, [])

  const removeParticipant = useCallback((participantId) => {
    setParticipants(prev => prev.filter(p => p.id !== participantId))
  }, [])

  const value = {
    user,
    setUser,
    roomInfo,
    setRoomInfo,
    participants,
    setParticipants,
    addParticipant,
    removeParticipant,
    messages,
    setMessages,
    addMessage,
    warnings,
    addWarning,
    isConnected,
    setIsConnected
  }

  return (
    <RoomContext.Provider value={value}>
      {children}
    </RoomContext.Provider>
  )
}

export function useRoom() {
  const context = useContext(RoomContext)
  if (!context) {
    throw new Error('useRoom must be used within RoomProvider')
  }
  return context
}
