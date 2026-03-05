import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../context/RoomContext'
import VideoGrid from './VideoGrid'
import Chat from './Chat'
import ModerationAlert from './ModerationAlert'
import useWebSocket from '../hooks/useWebSocket'
import useMediaStream from '../hooks/useMediaStream'

export default function Room() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, participants, warnings, addParticipant, removeParticipant, addWarning, addMessage, setIsConnected } = useRoom()
  
  const [showChat, setShowChat] = useState(true)
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [copied, setCopied] = useState(false)
  const [strikes, setStrikes] = useState(0)
  
  const { localStream, error: mediaError, toggleAudio, toggleVideo } = useMediaStream()
  const { sendMessage, isConnected } = useWebSocket(roomId, user)
  
  // Audio monitoring
  const mediaRecorderRef = useRef(null)
  const monitorWsRef = useRef(null)
  const videoIntervalRef = useRef(null)
  const canvasRef = useRef(null)

  // Redirect if no user
  useEffect(() => {
    if (!user.id) {
      navigate('/')
    }
  }, [user, navigate])

  // Connect to AI monitoring service
  useEffect(() => {
    if (!localStream || !user.id) return

    const connectMonitor = () => {
      const ws = new WebSocket('ws://localhost:8000/ws/monitor')
      monitorWsRef.current = ws

      ws.onopen = () => {
        console.log('[AI Monitor] ✅ Connected to AI monitoring service')
        startAudioCapture()
        startVideoCapture()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Log all AI responses for debugging
          if (data.type === 'audio_result') {
            console.log('[AI Audio] 🎤 Transcription:', data.transcription)
            console.log('[AI Audio] Detection:', data.detection?.label, 'score:', data.detection?.score, 'level:', data.detection?.level)
            if (data.detection?.keywords?.length) {
              console.log('[AI Audio] ⚠️ Violence keywords found:', data.detection.keywords)
            }
          }
          
          if (data.type === 'video_result') {
            console.log('[AI Video] 📹 Emotion:', data.emotion?.dominant, '(' + Math.round((data.emotion?.score || 0) * 100) + '%)')
          }
          
          if (data.type === 'violation') {
            const newStrikes = strikes + 1
            setStrikes(newStrikes)
            console.log('[AI Monitor] 🚨 VIOLATION DETECTED!')
            console.log('[AI Monitor] Source:', data.source, '| Reason:', data.reason)
            console.log('[AI Monitor] Strike count:', newStrikes, '/3')
            
            const sourceIcon = data.source === 'video' ? '📹' : '🎤'
            addWarning({
              id: Date.now().toString(),
              userId: user.id,
              userName: user.name,
              reason: `${sourceIcon} ${data.reason}`,
              severity: data.severity,
              strike: newStrikes,
              source: data.source
            })
            
            // Notify room
            sendMessage({
              type: 'moderation_alert',
              userId: user.id,
              userName: user.name,
              reason: data.reason,
              strike: newStrikes,
              source: data.source
            })
            
            // Auto-kick at 3 strikes
            if (newStrikes >= 3) {
              console.log('[AI Monitor] ❌ User kicked - 3 strikes reached')
              alert('You have been removed from the meeting due to repeated violations.')
              handleLeave()
            }
          }
        } catch (e) {
          // Non-JSON message (like binary acknowledgment), ignore
        }
      }

      ws.onclose = () => {
        console.log('[AI Monitor] Disconnected, reconnecting in 3s...')
        setTimeout(connectMonitor, 3000)
      }

      ws.onerror = (err) => {
        console.error('[AI Monitor] ❌ Connection error - is backend running on port 8000?')
      }
    }

    connectMonitor()

    return () => {
      if (monitorWsRef.current) {
        monitorWsRef.current.close()
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
      }
      if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current)
      }
    }
  }, [localStream, user.id])

  const startAudioCapture = () => {
    if (!localStream) return

    const audioTrack = localStream.getAudioTracks()[0]
    if (!audioTrack) {
      console.log('[AI Audio] No audio track available')
      return
    }

    console.log('[AI Audio] 🎤 Starting audio capture for monitoring')
    const audioStream = new MediaStream([audioTrack])
    
    const startRecording = () => {
      if (!monitorWsRef.current || monitorWsRef.current.readyState !== WebSocket.OPEN) return

      const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && monitorWsRef.current?.readyState === WebSocket.OPEN) {
          console.log('[AI Audio] Sending audio chunk:', event.data.size, 'bytes')
          monitorWsRef.current.send(event.data)
        }
      }

      recorder.onstop = () => {
        // Restart for continuous monitoring
        setTimeout(startRecording, 100)
      }

      recorder.start()
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop()
        }
      }, 3000)
    }

    startRecording()
  }

  const startVideoCapture = () => {
    if (!localStream) return
    const videoTrack = localStream.getVideoTracks()[0]
    if (!videoTrack) {
      console.log('[AI Video] No video track available')
      return
    }

    console.log('[AI Video] 📹 Starting video capture for emotion detection')
    
    // Create canvas for frame capture
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 240
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')

    // Create video element to draw from
    const video = document.createElement('video')
    video.srcObject = new MediaStream([videoTrack])
    video.play()

    // Capture frame every 2 seconds
    videoIntervalRef.current = setInterval(() => {
      if (!monitorWsRef.current || monitorWsRef.current.readyState !== WebSocket.OPEN) return
      if (isVideoOff) return

      try {
        ctx.drawImage(video, 0, 0, 320, 240)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        const base64 = dataUrl.split(',')[1]
        
        console.log('[AI Video] Sending video frame for analysis')
        monitorWsRef.current.send(JSON.stringify({
          type: 'video_frame',
          data: base64,
          userId: user.id,
          userName: user.name
        }))
      } catch (e) {
        // Ignore frame capture errors
      }
    }, 2000)
  }

  const handleToggleMute = () => {
    toggleAudio()
    setIsMuted(!isMuted)
  }

  const handleToggleVideo = () => {
    toggleVideo()
    setIsVideoOff(!isVideoOff)
  }

  const handleLeave = () => {
    if (monitorWsRef.current) monitorWsRef.current.close()
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop()
    navigate('/')
  }

  const copyMeetingCode = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (mediaError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-slate-800/50 rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">Camera/Microphone Access Required</h2>
          <p className="text-gray-400 mb-4">{mediaError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-700 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            SafeMeet
          </h1>
          <div className="h-4 w-px bg-slate-700"></div>
          <button
            onClick={copyMeetingCode}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <span className="font-mono">{roomId}</span>
            {copied ? (
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          {strikes > 0 && (
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
              strikes >= 2 ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {strikes}/3 strikes
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
            <span className="text-sm text-gray-400">
              {participants.length + 1} participant{participants.length !== 0 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col">
          <VideoGrid 
            localStream={localStream} 
            participants={participants}
            localUser={user}
          />
          
          {/* Controls */}
          <div className="h-20 bg-slate-900/80 backdrop-blur border-t border-slate-700 flex items-center justify-center gap-4">
            <button
              onClick={handleToggleMute}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isMuted ? 'bg-red-500 hover:bg-red-400' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleToggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? 'bg-red-500 hover:bg-red-400' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {isVideoOff ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                showChat ? 'bg-blue-600 hover:bg-blue-500' : 'bg-slate-700 hover:bg-slate-600'
              }`}
              title="Toggle chat"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>

            <div className="w-px h-8 bg-slate-700 mx-2"></div>

            <button
              onClick={handleLeave}
              className="px-6 h-12 bg-red-500 hover:bg-red-400 rounded-full flex items-center gap-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Leave
            </button>
          </div>
        </div>

        {/* Chat sidebar */}
        {showChat && (
          <div className="w-80 border-l border-slate-700 flex flex-col bg-slate-900/50">
            <Chat 
              roomId={roomId} 
              user={user} 
              onChatViolation={(strikeCount) => {
                console.log('[Room] Chat violation callback, strikes:', strikeCount)
                setStrikes(strikeCount)
                if (strikeCount >= 3) {
                  alert('You have been removed from the meeting due to repeated violations.')
                  handleLeave()
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Moderation alerts */}
      <ModerationAlert warnings={warnings} />
    </div>
  )
}
