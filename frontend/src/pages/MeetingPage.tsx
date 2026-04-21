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

  // E2EE passphrase comes ONLY from the URL fragment (`#key=...`). Fragments
  // are not sent to the server, which is the only property that makes this
  // genuinely end-to-end. Deriving the key from the public room code — as the
  // old build did — was not E2EE, just obfuscation; we no longer do that.
  //
  // The key is cached in sessionStorage so reloads don't drop it (the user
  // may reload the tab and the address bar keeps the fragment anyway, but on
  // cross-tab share-link opens the fragment is authoritative).
  const e2eePassphrase = (() => {
    if (!code) return undefined;
    const cacheKey = `lumina:roomkey:${code}`;
    const fragment = window.location.hash.replace(/^#/, '');
    if (fragment) {
      const params = new URLSearchParams(fragment);
      const key = params.get('key');
      if (key && key.length >= 16) {
        sessionStorage.setItem(cacheKey, key);
        return key;
      }
    }
    const cached = sessionStorage.getItem(cacheKey);
    return cached && cached.length >= 16 ? cached : undefined;
  })();

  return (
    <div className="h-screen">
      <MeetingRoom
        roomCode={code}
        userName={joinState.name}
        initialCamera={joinState.cameraOn ?? true}
        initialMic={joinState.micOn ?? true}
        e2eePassphrase={e2eePassphrase}
        onLeave={() => navigate('/')}
      />
    </div>
  );
}
