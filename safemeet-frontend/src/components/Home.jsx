import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRoom } from '../context/RoomContext'
import { v4 as uuidv4 } from 'uuid'

export default function Home() {
  const navigate = useNavigate()
  const { setUser, setRoomInfo } = useRoom()
  const [name, setName] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [mode, setMode] = useState('create') // 'create' or 'join'
  const [error, setError] = useState('')

  const handleCreateRoom = () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    
    const roomId = uuidv4().slice(0, 8)
    const userId = uuidv4()
    
    setUser({ id: userId, name: name.trim(), isHost: true })
    setRoomInfo({ id: roomId, hostId: userId })
    navigate(`/room/${roomId}`)
  }

  const handleJoinRoom = () => {
    if (!name.trim()) {
      setError('Please enter your name')
      return
    }
    if (!joinCode.trim()) {
      setError('Please enter a meeting code')
      return
    }
    
    const userId = uuidv4()
    setUser({ id: userId, name: name.trim(), isHost: false })
    setRoomInfo({ id: joinCode.trim() })
    navigate(`/room/${joinCode.trim()}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SafeMeet
          </h1>
          <p className="text-gray-400 mt-2">AI-Moderated Video Calls</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 shadow-xl border border-slate-700">
          {/* Tabs */}
          <div className="flex mb-6 bg-slate-900/50 rounded-lg p-1">
            <button
              onClick={() => { setMode('create'); setError('') }}
              className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'create' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              New Meeting
            </button>
            <button
              onClick={() => { setMode('join'); setError('') }}
              className={`flex-1 py-2 rounded-md transition-all ${
                mode === 'join' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Join Meeting
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Meeting Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setError('') }}
                  placeholder="Enter meeting code"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-500"
                />
              </div>
            )}

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <button
              onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-lg font-medium transition-all transform hover:scale-[1.02]"
            >
              {mode === 'create' ? 'Start Meeting' : 'Join Meeting'}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <div className="flex items-start gap-3 text-sm text-gray-400">
              <svg className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p>
                This meeting is protected by AI moderation. Hate speech and harmful content will be detected automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          By joining, you agree to respectful communication guidelines
        </p>
      </div>
    </div>
  )
}
