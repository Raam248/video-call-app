import { useRef, useEffect } from 'react'

export default function VideoGrid({ localStream, participants, localUser }) {
  const localVideoRef = useRef(null)
  const totalCount = participants.length + 1

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream
      console.log('[Video Grid] Local video stream attached')
      
      // Force play on user interaction
      localVideoRef.current.play().catch(e => {
        console.log('[Video Grid] Auto-play blocked, will play on interaction')
      })
    }
  }, [localStream])

  const getGridClass = () => {
    if (totalCount <= 1) return 'grid-1'
    if (totalCount <= 2) return 'grid-2'
    if (totalCount <= 4) return 'grid-4'
    return 'grid-6'
  }

  return (
    <div className={`flex-1 video-grid ${getGridClass()} bg-slate-900/30 overflow-auto`}>
      {/* Local video */}
      <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <span className="px-2 py-1 bg-slate-900/80 backdrop-blur rounded text-sm">
            {localUser?.name || 'You'} (You)
          </span>
          {localUser?.isHost && (
            <span className="px-2 py-1 bg-blue-600/80 backdrop-blur rounded text-xs">
              Host
            </span>
          )}
        </div>
      </div>

      {/* Remote participants */}
      {participants.map((participant) => (
        <ParticipantVideo key={participant.id} participant={participant} />
      ))}

      {/* Empty state */}
      {participants.length === 0 && (
        <div className="flex items-center justify-center bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700">
          <div className="text-center p-4">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-slate-500">Waiting for others to join...</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ParticipantVideo({ participant }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream
    }
  }, [participant.stream])

  return (
    <div className="relative bg-slate-800 rounded-xl overflow-hidden aspect-video">
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-800">
          <div className="w-20 h-20 rounded-full bg-slate-600 flex items-center justify-center text-2xl font-semibold">
            {participant.name?.charAt(0).toUpperCase() || '?'}
          </div>
        </div>
      )}
      <div className="absolute bottom-3 left-3">
        <span className="px-2 py-1 bg-slate-900/80 backdrop-blur rounded text-sm">
          {participant.name}
        </span>
      </div>
      {participant.isMuted && (
        <div className="absolute top-3 right-3">
          <span className="p-1.5 bg-red-500/80 backdrop-blur rounded-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          </span>
        </div>
      )}
    </div>
  )
}
