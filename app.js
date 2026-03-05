// ===============================
// State
// ===============================

let ws = null;
let mediaRecorder = null;
let mediaStream = null;
let stats = {
  chunks: 0,
  alerts: 0
};

// ===============================
// DOM Elements
// ===============================

const statusEl = document.getElementById("status");
const statusDot = document.getElementById("statusDot");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const webcamEl = document.getElementById("webcam");
const emotionOverlay = document.getElementById("emotionOverlay");

const alertBanner = document.getElementById("alertBanner");
const alertIcon = document.getElementById("alertIcon");
const alertText = document.getElementById("alertText");

const totalChunksEl = document.getElementById("totalChunks");
const alertCountEl = document.getElementById("alertCount");
const currentScoreEl = document.getElementById("currentScore");

const transcriptionFeed = document.getElementById("transcriptionFeed");
const alertHistory = document.getElementById("alertHistory");

// ===============================
// Config
// ===============================

const BACKEND_WS_URL = "ws://127.0.0.1:8000/ws/monitor";
const CHUNK_INTERVAL_MS = 3000; // 3 seconds per chunk (give model time)
const VIDEO_FRAME_INTERVAL_MS = 2000;

let videoFrameInterval = null;
let canvasEl = null;
let isProcessing = false; // Prevent chunk buildup

// ===============================
// UI Helpers
// ===============================

function setStatus(text, dotClass = "") {
  statusEl.innerText = text;
  statusDot.className = "status-dot " + dotClass;
}

function updateStats() {
  totalChunksEl.innerText = stats.chunks;
  alertCountEl.innerText = stats.alerts;
}

function showAlertBanner(level, text) {
  alertBanner.className = "alert-banner " + level;
  if (level === "critical") {
    alertIcon.innerText = "🔴";
    alertBanner.className = "alert-banner danger"; // Use danger styling for critical
  } else {
    alertIcon.innerText = level === "danger" ? "🚨" : level === "warning" ? "⚠️" : "✅";
  }
  alertText.innerText = text;
}

function updateEmotionOverlay(emotion, score) {
  const emoji = {
    "angry": "😠",
    "disgust": "🤢",
    "fear": "😨",
    "happy": "😄",
    "sad": "😢",
    "surprise": "😲",
    "neutral": "😐"
  };
  const icon = emoji[emotion] || "❓";
  emotionOverlay.innerText = `${icon} ${emotion} (${(score * 100).toFixed(0)}%)`;
  
  // Color based on emotion
  if (emotion === "angry") {
    emotionOverlay.style.background = "rgba(255, 71, 87, 0.8)";
  } else if (emotion === "happy") {
    emotionOverlay.style.background = "rgba(0, 255, 136, 0.8)";
  } else {
    emotionOverlay.style.background = "rgba(0, 0, 0, 0.7)";
  }
}

function addTranscription(text, alertLevel, timestamp) {
  // Remove placeholder
  const placeholder = transcriptionFeed.querySelector(".placeholder");
  if (placeholder) placeholder.remove();
  
  const item = document.createElement("div");
  item.className = `transcript-item ${alertLevel !== 'safe' ? alertLevel : ''}`;
  
  const time = new Date(timestamp).toLocaleTimeString();
  item.innerHTML = `
    <div class="transcript-time">${time}</div>
    <div class="transcript-text">${text}</div>
  `;
  
  transcriptionFeed.insertBefore(item, transcriptionFeed.firstChild);
  
  // Keep only last 20 items
  while (transcriptionFeed.children.length > 20) {
    transcriptionFeed.removeChild(transcriptionFeed.lastChild);
  }
}

function addAlertToHistory(label, text, score, timestamp) {
  // Remove placeholder
  const placeholder = alertHistory.querySelector(".placeholder");
  if (placeholder) placeholder.remove();
  
  const level = score >= 0.7 ? "danger" : "warning";
  const item = document.createElement("div");
  item.className = `alert-item ${level}`;
  
  const time = new Date(timestamp).toLocaleTimeString();
  item.innerHTML = `
    <span>${level === "danger" ? "🚨" : "⚠️"}</span>
    <div class="alert-item-content">
      <div class="alert-item-label">${label} (${(score * 100).toFixed(0)}%)</div>
      <div class="alert-item-text">${text.substring(0, 100)}${text.length > 100 ? '...' : ''}</div>
    </div>
    <div class="alert-item-time">${time}</div>
  `;
  
  alertHistory.insertBefore(item, alertHistory.firstChild);
  
  // Keep only last 10 alerts
  while (alertHistory.children.length > 10) {
    alertHistory.removeChild(alertHistory.lastChild);
  }
}

// ===============================
// WebSocket Message Handler
// ===============================

function handleWebSocketMessage(event) {
  try {
    const data = JSON.parse(event.data);
    
    if (data.type === "status") {
      setStatus(data.message, "processing");
      return;
    }
    
    // Handle audio results
    if (data.type === "audio_result") {
      stats.chunks++;
      updateStats();
      
      const { transcription, detection, timestamp, fusion } = data;
      const { level, score, label, keywords } = detection;
      
      // Update current score
      currentScoreEl.innerText = score.toFixed(2);
      
      // Add to transcription feed
      addTranscription(transcription, level, timestamp);
      
      // Check fusion alert (multimodal)
      if (fusion && fusion.level !== "safe") {
        stats.alerts++;
        updateStats();
        showAlertBanner(fusion.level, fusion.reason || `${fusion.level.toUpperCase()} Alert!`);
        addAlertToHistory(fusion.level.toUpperCase(), fusion.reason || transcription, score, timestamp);
      } else if (level === "danger") {
        stats.alerts++;
        updateStats();
        showAlertBanner("danger", `DANGER: ${label} detected!`);
        addAlertToHistory(label, transcription, score, timestamp);
      } else if (level === "warning") {
        stats.alerts++;
        updateStats();
        showAlertBanner("warning", `Warning: Potential ${label}`);
        addAlertToHistory(label, transcription, score, timestamp);
      } else {
        showAlertBanner("safe", "All clear - no threats detected");
      }
      
      setStatus("Connected & Monitoring", "connected");
      isProcessing = false; // Ready for next chunk
      console.log("Audio Result:", data);
    }
    
    // Handle video/emotion results
    if (data.type === "video_result") {
      const { emotion, fusion, timestamp } = data;
      
      // Update emotion overlay
      updateEmotionOverlay(emotion.dominant, emotion.score);
      
      // Check for fusion alerts from video
      if (fusion && fusion.level !== "safe") {
        stats.alerts++;
        updateStats();
        showAlertBanner(fusion.level, fusion.reason);
        if (fusion.level === "critical" || fusion.level === "danger") {
          addAlertToHistory("MULTIMODAL", fusion.reason, 0.9, timestamp);
        }
      }
      
      console.log("Video Result:", data);
    }
    
  } catch (err) {
    console.error("Error parsing WebSocket message:", err);
  }
}

// ===============================
// Video Frame Capture
// ===============================

function captureAndSendFrame() {
  if (!ws || ws.readyState !== WebSocket.OPEN || !webcamEl.srcObject) {
    return;
  }
  
  try {
    // Create canvas if not exists
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
    }
    
    // Set canvas size (smaller for performance)
    const width = 320;
    const height = 240;
    canvasEl.width = width;
    canvasEl.height = height;
    
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(webcamEl, 0, 0, width, height);
    
    // Convert to JPEG base64
    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.7);
    const base64Data = dataUrl.split(',')[1];
    
    // Send as JSON message
    ws.send(JSON.stringify({
      type: 'video_frame',
      data: base64Data
    }));
    
  } catch (err) {
    console.error("Error capturing frame:", err);
  }
}

// ===============================
// Start Monitoring
// ===============================

startBtn.onclick = async () => {
  try {
    setStatus("Checking devices...", "processing");
    
    // List available devices first
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasAudioDevice = devices.some(d => d.kind === 'audioinput');
    const hasVideoDevice = devices.some(d => d.kind === 'videoinput');
    
    console.log("Available devices:", devices);
    console.log("Has audio:", hasAudioDevice, "Has video:", hasVideoDevice);
    
    if (!hasAudioDevice) {
      throw new Error("No microphone found. Please connect a microphone.");
    }
    
    setStatus("Connecting...", "processing");
    
    // Get audio first (required)
    let hasVideo = false;
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("Audio stream acquired");
    
    // Try to add video (optional)
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Combine audio + video tracks
      videoStream.getVideoTracks().forEach(track => mediaStream.addTrack(track));
      webcamEl.srcObject = mediaStream;
      hasVideo = true;
      console.log("Video stream acquired");
    } catch (videoErr) {
      console.warn("No webcam available, using audio-only:", videoErr.message);
      emotionOverlay.innerText = "🎤 Audio only";
      emotionOverlay.style.background = "rgba(0, 150, 255, 0.8)";
    }
    
    // Connect WebSocket
    ws = new WebSocket(BACKEND_WS_URL);
    
    ws.onopen = () => {
      setStatus("Connected & Monitoring", "connected");
      startBtn.disabled = true;
      stopBtn.disabled = false;
      console.log("WebSocket connected");
    };
    
    ws.onclose = () => {
      setStatus("Disconnected", "");
      startBtn.disabled = false;
      stopBtn.disabled = true;
      console.log("WebSocket closed");
    };
    
    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("Connection Error", "error");
    };
    
    ws.onmessage = handleWebSocketMessage;
    
    // Create audio stream for recording
    const audioStream = new MediaStream(mediaStream.getAudioTracks());
    
    // Function to record and send audio
    function recordAndSend() {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }
      
      console.log("Recording audio...");
      const recorder = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
      const chunks = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      
      recorder.onstop = async () => {
        if (chunks.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
          const blob = new Blob(chunks, { type: "audio/webm" });
          const buffer = await blob.arrayBuffer();
          ws.send(buffer);
          console.log("Sent audio chunk:", buffer.byteLength, "bytes");
        }
      };
      
      recorder.start();
      setTimeout(() => {
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }, CHUNK_INTERVAL_MS);
    }
    
    // Start recording loop with fixed interval
    recordAndSend(); // First one immediately
    const audioInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        recordAndSend();
      } else {
        clearInterval(audioInterval);
      }
    }, CHUNK_INTERVAL_MS + 1000); // Record every 4 seconds (3s recording + 1s gap)
    
    // Start sending video frames only if we have video
    if (hasVideo) {
      videoFrameInterval = setInterval(captureAndSendFrame, VIDEO_FRAME_INTERVAL_MS);
    }
    
  } catch (err) {
    console.error("Error starting monitoring:", err);
    setStatus("Error: " + err.message, "error");
  }
};

// ===============================
// Stop Monitoring
// ===============================

stopBtn.onclick = () => {
  // Stop video frame capture
  if (videoFrameInterval) {
    clearInterval(videoFrameInterval);
    videoFrameInterval = null;
  }
  
  // Stop media recorder
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
  mediaRecorder = null;
  
  // Stop all media tracks
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  
  // Clear webcam
  webcamEl.srcObject = null;
  
  // Close WebSocket
  if (ws) {
    ws.close();
    ws = null;
  }
  
  // Reset emotion overlay
  emotionOverlay.innerText = "--";
  emotionOverlay.style.background = "rgba(0, 0, 0, 0.7)";
  
  setStatus("Stopped", "");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  // Hide alert banner
  alertBanner.className = "alert-banner hidden";
};
