# AI Meeting Monitor - Frontend

Real-time monitoring dashboard with hate speech and emotion detection.

## Quick Start

1. Start the backend server first
2. Serve frontend: `python -m http.server 3000`
3. Open `http://localhost:3000`
4. Allow camera/microphone
5. Click "Start Monitoring"

## Configuration

Edit `app.js`:
```javascript
const BACKEND_WS_URL = "ws://127.0.0.1:8000/ws/monitor";
const CHUNK_INTERVAL_MS = 4000;        // Audio interval
const VIDEO_FRAME_INTERVAL_MS = 2000;  // Video interval
```

## Features

- Webcam preview with emotion overlay
- Real-time transcription feed
- Alert history panel
- Multimodal fusion alerts