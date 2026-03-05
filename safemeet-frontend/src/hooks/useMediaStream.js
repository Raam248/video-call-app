import { useState, useEffect, useRef, useCallback } from 'react'

export default function useMediaStream() {
  const [localStream, setLocalStream] = useState(null)
  const [error, setError] = useState(null)
  const streamRef = useRef(null)

  useEffect(() => {
    const initMedia = async () => {
      try {
        // Check for available devices first
        const devices = await navigator.mediaDevices.enumerateDevices()
        const hasVideo = devices.some(d => d.kind === 'videoinput')
        const hasAudio = devices.some(d => d.kind === 'audioinput')

        if (!hasAudio) {
          setError('No microphone found. Audio is required for this call.')
          return
        }

        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: hasVideo ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          } : false
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)
        streamRef.current = stream
        setLocalStream(stream)
        setError(null)

        console.log('[Media] ✅ Stream initialized successfully')
        console.log('[Media] Audio tracks:', stream.getAudioTracks().length)
        console.log('[Media] Video tracks:', stream.getVideoTracks().length)
        if (stream.getVideoTracks().length > 0) {
          const videoTrack = stream.getVideoTracks()[0]
          console.log('[Media] Video track settings:', videoTrack.getSettings())
        }
      } catch (err) {
        console.error('Media access error:', err)
        if (err.name === 'NotAllowedError') {
          setError('Camera/microphone access denied. Please allow access in your browser settings.')
        } else if (err.name === 'NotFoundError') {
          setError('No camera or microphone found on your device.')
        } else {
          setError(`Failed to access media devices: ${err.message}`)
        }
      }
    }

    initMedia()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        return audioTrack.enabled
      }
    }
    return false
  }, [])

  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        return videoTrack.enabled
      }
    }
    return false
  }, [])

  return {
    localStream,
    error,
    toggleAudio,
    toggleVideo
  }
}
