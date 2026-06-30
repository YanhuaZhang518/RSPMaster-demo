import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './components/HomePage';
import { RoomPage } from './components/RoomPage';
import { BattlePage } from './components/BattlePage';
import { EndPage } from './components/EndPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:roomId" element={<RoomPage />} />
        <Route path="/room/:roomId/battle" element={<BattlePage />} />
        <Route path="/room/:roomId/end" element={<EndPage />} />
      </Routes>
    </BrowserRouter>
  );
}
