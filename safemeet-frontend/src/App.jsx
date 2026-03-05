import { Routes, Route } from 'react-router-dom'
import { RoomProvider } from './context/RoomContext'
import Home from './components/Home'
import Room from './components/Room'

function App() {
  return (
    <RoomProvider>
      <div className="min-h-screen text-white">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </div>
    </RoomProvider>
  )
}

export default App
