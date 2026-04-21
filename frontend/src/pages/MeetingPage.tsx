import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { MeetingRoom } from '../components/meeting/MeetingRoom';
import { PreJoinPage } from './PreJoinPage';
import { checkRoomExists } from '../lib/api';
import { t } from '../lib/i18n';

export function MeetingPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const navState = location.state as {
    name?: string;
    cameraOn?: boolean;
    micOn?: boolean;
  } | null;

  const [joinState, setJoinState] = useState(navState?.name ? navState : null);
  const [roomValid, setRoomValid] = useState<boolean | null>(null);

  // Check room exists before showing anything
  useEffect(() => {
    if (!code) return;
    checkRoomExists(code).then((exists) => {
      setRoomValid(exists);
    });
  }, [code]);

  if (!code) return null;

  // Still checking
  if (roomValid === null) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Room doesn't exist
  if (!roomValid) {
    return (
      <div className="h-screen flex flex-col items-center justify-center px-4 gap-4">
        <div className="w-16 h-16 rounded-full bg-[var(--danger)]/20 flex items-center justify-center">
          <span className="text-3xl">✕</span>
        </div>
        <h2 className="text-xl font-semibold text-center">{t('meetingPage.notFound')}</h2>
        <p className="text-[var(--text-secondary)] text-center text-sm max-w-xs">
          {t('meetingPage.notFoundDesc')}
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-2 h-12 px-8 rounded-xl bg-[var(--accent)] text-white font-medium hover:brightness-110 transition"
        >
          {t('meetingPage.goHome')}
        </button>
      </div>
    );
  }

  // If no name yet (direct URL access), show preview inline
  if (!joinState?.name) {
    return <PreJoinPage onJoin={(name, cameraOn, micOn) => setJoinState({ name, cameraOn, micOn })} />;
  }

  // E2EE key is fetched from the server along with the join token (same
  // per-room secret for everyone, but LiveKit SFU never sees it). MeetingRoom
  // owns the mint flow, so we pass the code and let it populate the key.
  return (
    <div className="h-screen">
      <MeetingRoom
        roomCode={code}
        userName={joinState.name}
        initialCamera={joinState.cameraOn ?? true}
        initialMic={joinState.micOn ?? true}
        onLeave={() => navigate('/')}
      />
    </div>
  );
}
