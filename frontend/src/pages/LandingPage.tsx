import { useReducer, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, ArrowRight, Plus, Copy, Check, Link, Users } from 'lucide-react';

import { createRoom, checkRoomExists } from '../lib/api';
import { t } from '../lib/i18n';

interface State {
  loading: boolean;
  joining: boolean;
  error: string;
  createdLink: string;
  copied: boolean;
}

type Action =
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'SET_JOINING'; value: boolean }
  | { type: 'SET_ERROR'; value: string }
  | { type: 'SET_CREATED_LINK'; value: string }
  | { type: 'SET_COPIED'; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: action.value };
    case 'SET_JOINING': return { ...state, joining: action.value };
    case 'SET_ERROR': return { ...state, error: action.value };
    case 'SET_CREATED_LINK': return { ...state, createdLink: action.value };
    case 'SET_COPIED': return { ...state, copied: action.value };
  }
}

const initialState: State = {
  loading: false,
  joining: false,
  error: '',
  createdLink: '',
  copied: false,
};

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      handleCreate();
    }
  }, []);

  async function handleCreate() {
    dispatch({ type: 'SET_LOADING', value: true });
    dispatch({ type: 'SET_ERROR', value: '' });
    try {
      const { code, creatorToken } = await createRoom();
      // creator_token is one-shot; cache it to mint the host token on first
      // navigation into the meeting.
      sessionStorage.setItem(`lumina:creator:${code}`, creatorToken);

      const link = `${window.location.origin}/room/${code}`;
      dispatch({ type: 'SET_CREATED_LINK', value: link });
    } catch {
      dispatch({ type: 'SET_ERROR', value: t('landing.error.create') });
    } finally {
      dispatch({ type: 'SET_LOADING', value: false });
    }
  }

  async function handleJoin() {
    dispatch({ type: 'SET_JOINING', value: true });
    dispatch({ type: 'SET_ERROR', value: '' });
    try {
      const text = await navigator.clipboard.readText();
      const match = text.match(/\/room\/([a-z0-9]+)/i);
      if (!match) {
        dispatch({ type: 'SET_ERROR', value: t('landing.error.noLink') });
        dispatch({ type: 'SET_JOINING', value: false });
        return;
      }
      const code = match[1].toLowerCase();
      const exists = await checkRoomExists(code);
      if (exists) {
        navigate(`/room/${code}/preview`);
      } else {
        dispatch({ type: 'SET_ERROR', value: t('landing.error.expired') });
      }
    } catch {
      dispatch({ type: 'SET_ERROR', value: t('landing.error.clipboard') });
    } finally {
      dispatch({ type: 'SET_JOINING', value: false });
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(state.createdLink);
    dispatch({ type: 'SET_COPIED', value: true });
    setTimeout(() => dispatch({ type: 'SET_COPIED', value: false }), 2000);
  }

  function handleGoToRoom() {
    const match = state.createdLink.match(/\/room\/([a-z0-9]+)/);
    if (match) navigate(`/room/${match[1]}/preview`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 safe-top safe-bottom">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] flex items-center justify-center">
            <Video className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{t('app.title')}</h1>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-md space-y-3">
        {!state.createdLink ? (
          <>
            <button
              onClick={handleCreate}
              disabled={state.loading}
              className="w-full h-14 rounded-2xl bg-[var(--accent)] text-white font-semibold text-lg
                flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50"
            >
              {state.loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Plus className="w-5 h-5" />
              )}
              {t('landing.create')}
            </button>

            <button
              onClick={handleJoin}
              disabled={state.joining}
              className="w-full h-14 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)]
                text-white font-semibold text-lg flex items-center justify-center gap-2
                hover:border-[var(--accent)] transition disabled:opacity-50"
            >
              {state.joining ? (
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Users className="w-5 h-5 text-[var(--accent)]" />
              )}
              {t('landing.join')}
            </button>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 h-14 px-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--accent)]/40">
              <Link className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="flex-1 text-sm text-white truncate font-mono">{state.createdLink}</span>
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition shrink-0"
              >
                {state.copied ? (
                  <Check className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 h-12 rounded-xl bg-[var(--bg-tertiary)] text-white font-medium
                  flex items-center justify-center gap-2 hover:bg-[var(--bg-hover)] transition text-sm"
              >
                {state.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {state.copied ? t('landing.copied') : t('landing.copy')}
              </button>
              <button
                onClick={handleGoToRoom}
                className="flex-1 h-12 rounded-xl bg-[var(--accent)] text-white font-medium
                  flex items-center justify-center gap-2 hover:brightness-110 transition text-sm"
              >
                {t('landing.enter')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {state.error && (
          <p className="text-[var(--danger)] text-sm text-center">{state.error}</p>
        )}
      </div>
    </div>
  );
}
