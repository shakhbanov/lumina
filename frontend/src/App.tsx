import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { PreJoinPage } from './pages/PreJoinPage';
import { MeetingPage } from './pages/MeetingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/room/:code/preview" element={<PreJoinPage />} />
        <Route path="/room/:code" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
