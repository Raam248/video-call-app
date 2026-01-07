let ws = null;
let mediaRecorder = null;

const statusEl = document.getElementById("status");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");

startBtn.onclick = async () => {
  try {
    // Connect to backend WebSocket
    ws = new WebSocket("ws://127.0.0.1:8000/ws/audio");

    ws.onopen = () => {
      statusEl.innerText = "Connected & Streaming";
      startBtn.disabled = true;
      stopBtn.disabled = false;
      console.log("WebSocket connected");
    };

    ws.onclose = () => {
      statusEl.innerText = "Disconnected";
      startBtn.disabled = false;
      stopBtn.disabled = true;
      console.log("WebSocket closed");
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Create MediaRecorder
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: "audio/webm"
    });

    // Send audio chunks every 4 seconds
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const buffer = await event.data.arrayBuffer();
        ws.send(buffer);
        console.log("Sent audio chunk:", buffer.byteLength, "bytes");
      }
    };

    mediaRecorder.start(4000); // 4 second chunks

  } catch (err) {
    console.error("Error starting audio stream:", err);
    statusEl.innerText = "Error";
  }
};

stopBtn.onclick = () => {
  if (mediaRecorder) {
    mediaRecorder.stop();
    mediaRecorder = null;
  }

  if (ws) {
    ws.close();
    ws = null;
  }

  statusEl.innerText = "Stopped";
  startBtn.disabled = false;
  stopBtn.disabled = true;
};
