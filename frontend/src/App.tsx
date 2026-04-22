import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AboutPage } from './pages/AboutPage';
import { FaqPage } from './pages/FaqPage';
import { InstallPage } from './pages/InstallPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

// Heavy, browser-only routes — split out so SSR prerender does not import
// LiveKit / MediaStream / WebRTC code for static pages. These chunks load on
// the client when the user actually navigates into a room.
const PreJoinPage = lazy(() =>
  import('./pages/PreJoinPage').then((m) => ({ default: m.PreJoinPage })),
);
const MeetingPage = lazy(() =>
  import('./pages/MeetingPage').then((m) => ({ default: m.MeetingPage })),
);

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/install" element={<InstallPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/room/:code/preview" element={<PreJoinPage />} />
        <Route path="/room/:code" element={<MeetingPage />} />
      </Routes>
    </Suspense>
  );
}
