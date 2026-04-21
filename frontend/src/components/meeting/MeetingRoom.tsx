import { useCallback, useEffect, useRef, useMemo, useState } from 'react';
import { ConnectionState } from 'livekit-client';
import { Header } from './Header';
import { VideoGrid } from './VideoGrid';
import { SpeakerView } from './SpeakerView';
import { FloatingReactions } from './FloatingReactions';
import { AudioRenderer } from './AudioRenderer';
import { Toolbar } from '../toolbar/Toolbar';
import { ChatPanel } from '../sidebar/ChatPanel';
import { ParticipantsPanel } from '../sidebar/ParticipantsPanel';
import { ToastContainer, useToasts } from '../ui/Toast';
import { ConnectionBanner } from '../ui/ConnectionBanner';
import { LeaveConfirmModal } from '../modals/LeaveConfirmModal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useRoom } from '../../hooks/useRoom';
import { useRecording } from '../../hooks/useRecording';
import { useLiveKit } from '../../hooks/useLiveKit';
import { useMeetingReducer } from '../../hooks/useMeetingReducer';
import { useStreamCache } from '../../hooks/useStreamCache';
import { mintParticipantToken, joinRoomPublic } from '../../lib/api';
import { takeStream } from '../../lib/stream-store';
import { t } from '../../lib/i18n';
import type { Participant } from '../../types';

interface MeetingRoomProps {
  roomCode: string;
  userName: string;
  initialCamera: boolean;
  initialMic: boolean;
  onLeave: () => void;
}

export function MeetingRoom({ roomCode, userName, initialCamera, initialMic, onLeave }: MeetingRoomProps) {
  const [state, dispatch] = useMeetingReducer();
  const previewStreamRef = useRef(takeStream());
  const lkConnectedRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // E2EE key is server-supplied at token mint time and cached in session so
  // reconnects don't need a second round-trip. Everyone in the room gets the
  // same key; the LiveKit SFU never sees it (it lives only in /api responses
  // under TLS and in the browser's memory).
  const [e2eePassphrase, setE2eePassphrase] = useState<string | undefined>(() => {
    const cached = sessionStorage.getItem(`lumina:roomkey:${roomCode}`);
    return cached && cached.length >= 16 ? cached : undefined;
  });

  const { toasts, addToast, removeToast } = useToasts();
  const ws = useWebSocket();
  const recording = useRecording();
  const nameCache = useRef(new Map<string, string>());

  // LiveKit (media)
  const lk = useLiveKit({
    e2eePassphrase,
    onParticipantJoined: useCallback((identity: string, name: string) => {
      nameCache.current.set(identity, name);
      addToast(`${name} ${t('toast.joined')}`, 'info');
    }, []),
    onParticipantLeft: useCallback((identity: string) => {
      const name = nameCache.current.get(identity) || identity;
      nameCache.current.delete(identity);
      addToast(`${name} ${t('toast.left')}`, 'info');
    }, []),
    onActiveSpeakersChanged: useCallback((speakers: string[]) => {
      if (speakers.length > 0) dispatch({ type: 'SET_ACTIVE_SPEAKER', id: speakers[0] });
    }, []),
    onConnectionStateChange: useCallback((cs: ConnectionState) => {
      if (cs === ConnectionState.Connected) {
        if (lkConnectedRef.current === false && state.connectionStatus !== 'connecting') {
          addToast(t('toast.reconnected'), 'success');
        }
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'connected' });
        lkConnectedRef.current = true;
      } else if (cs === ConnectionState.Reconnecting) {
        dispatch({ type: 'SET_CONNECTION_STATUS', status: 'reconnecting' });
      } else if (cs === ConnectionState.Disconnected) {
        if (lkConnectedRef.current) dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
        lkConnectedRef.current = false;
      }
    }, []),
  });

  // Room state (participants metadata via WS)
  const room = useRoom({ roomCode, myParticipantId: state.myParticipantId, onWs: ws.on, sendWs: ws.send });
  const roomRef = useRef(room.participants);
  roomRef.current = room.participants;

  // ── Initialize ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Prefer stored join_token for this room (re-auth on reload); fall
        // back to the creator_token issued to the room creator. If neither
        // exists, the backend refuses — that means someone followed a shared
        // link without a creator_token, which is exactly how it should work
        // for a second participant. Second participants mint via the creator
        // sharing the link (no server-side permissions split in this build).
        const joinKey = `lumina:join:${roomCode}`;
        const creatorKey = `lumina:creator:${roomCode}`;
        const storedJoin = sessionStorage.getItem(joinKey);
        const creator = sessionStorage.getItem(creatorKey);

        let tokens;
        if (storedJoin) {
          tokens = await mintParticipantToken(roomCode, userName, storedJoin);
        } else if (creator) {
          tokens = await mintParticipantToken(roomCode, userName, creator);
          sessionStorage.removeItem(creatorKey);
        } else {
          tokens = await joinRoomPublic(roomCode, userName);
        }
        if (cancelled) return;

        sessionStorage.setItem(joinKey, tokens.joinToken);
        if (tokens.e2eeKey) {
          sessionStorage.setItem(`lumina:roomkey:${roomCode}`, tokens.e2eeKey);
          setE2eePassphrase(tokens.e2eeKey);
        }

        dispatch({ type: 'SET_PARTICIPANT_ID', id: tokens.identity });
        ws.connect(roomCode, tokens.joinToken);
        await lk.connect(tokens.url, tokens.livekitToken, previewStreamRef.current, initialCamera, initialMic, tokens.e2eeKey || undefined);
      } catch (err) {
        console.error('[MeetingRoom] Failed to connect:', err);
        if (!cancelled) {
          addToast(t('toast.mediaError'), 'error');
          dispatch({ type: 'SET_CONNECTION_STATUS', status: 'disconnected' });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Join room via WS (identity is bound by the JWT, not the payload) ──
  useEffect(() => {
    if (!ws.connected) return;
    ws.send('meeting.join', { room_code: roomCode, name: userName });
  }, [ws.connected]);

  // ── WS event handlers ──
  useEffect(() => {
    const unsubs = [
      ws.on('meeting.peer_joined', (msg) => {
        const p = msg.payload as { participant_id: string; name: string };
        if (p.name === userName) dispatch({ type: 'SET_PARTICIPANT_ID', id: p.participant_id });
      }),
      ws.on('meeting.chat', (msg) => {
        const p = msg.payload as { sender_id: string; sender_name: string; content: string };
        if (p.sender_id !== state.myParticipantId && state.sidebarPanel !== 'chat') {
          addToast(`${p.sender_name}: ${p.content.slice(0, 50)}${p.content.length > 50 ? '...' : ''}`, 'info', 4000);
        }
      }),
      ws.on('meeting.hand_raise', (msg) => {
        const p = msg.payload as { participant_id: string; raised: boolean };
        const wsP = room.participants.get(p.participant_id);
        dispatch({
          type: 'UPDATE_RAISED_HANDS',
          updater: (prev) => {
            const next = new Set(prev);
            if (p.raised) { next.add(p.participant_id); if (wsP?.name) next.add(wsP.name); }
            else { next.delete(p.participant_id); if (wsP?.name) next.delete(wsP.name); }
            return next;
          },
        });
      }),
      ws.on('meeting.reaction', (msg) => {
        const p = msg.payload as { participant_id: string; emoji: string };
        const name = room.participants.get(p.participant_id)?.name
          || nameCache.current.get(p.participant_id) || '';
        const id = `r-${Date.now()}-${Math.random()}`;
        dispatch({ type: 'ADD_REACTION', reaction: { id, emoji: p.emoji, name } });
        setTimeout(() => dispatch({ type: 'REMOVE_REACTION', id }), 3000);
      }),
      ws.on('meeting.mute_participant', (msg) => {
        const p = msg.payload as { target_id: string; muted: boolean };
        if (p.target_id === state.myParticipantId && p.muted) {
          lk.setMicrophoneEnabled(false);
          addToast(t('toast.muted'), 'warning');
        }
      }),
      ws.on('meeting.room_closed', () => {
        addToast(t('toast.roomClosed'), 'warning');
        lk.disconnect();
        ws.disconnect();
        setTimeout(() => onLeave(), 1500);
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws.on, state.myParticipantId, state.sidebarPanel, room.participants]);

  // ── Auto switch to SpeakerView on screen share (local or remote) ──
  useEffect(() => {
    const hasScreen =
      lk.localParticipantInfo?.isScreenSharing ||
      Array.from(lk.remoteParticipants.values()).some((p) => p.isScreenSharing);
    if (hasScreen && state.viewMode === 'grid') dispatch({ type: 'SET_VIEW_MODE', viewMode: 'speaker' });
  }, [lk.remoteParticipants, lk.localParticipantInfo]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'd') { e.preventDefault(); lk.toggleMicrophone(); }
      else if (mod && e.key === 'e') { e.preventDefault(); lk.toggleCamera(); }
      else if (mod && e.key === 'y') { e.preventDefault(); handleToggleHand(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Auto-hide toolbar (timers) ──
  const resetHideTimer = useCallback(() => {
    clearTimeout(hideTimer.current);
    dispatch({ type: 'SET_TOOLBAR_VISIBLE', visible: true });
    hideTimer.current = setTimeout(() => dispatch({ type: 'SET_TOOLBAR_VISIBLE', visible: false }), 5000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, []);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => { if (window.innerHeight - e.clientY < 120) resetHideTimer(); };
    const onTouch = () => resetHideTimer();
    window.addEventListener('mousemove', onMouse);
    window.addEventListener('touchstart', onTouch, { passive: true });
    return () => { window.removeEventListener('mousemove', onMouse); window.removeEventListener('touchstart', onTouch); };
  }, [resetHideTimer]);

  // ── Action handlers ──
  const handleToggleHand = useCallback(() => {
    const next = !state.isHandRaised;
    dispatch({ type: 'SET_HAND_RAISED', raised: next });
    room.toggleHandRaise(next);
  }, [state.isHandRaised, room.toggleHandRaise]);

  const handleToggleScreenShare = useCallback(async () => {
    try {
      const isNowSharing = await lk.toggleScreenShare();
      ws.send('meeting.screen_share', { room_code: roomCode, participant_id: state.myParticipantId, active: isNowSharing });
    } catch (err) {
      console.error('[MeetingRoom] Screen share error:', err);
      addToast(t('toast.screenShareError'), 'error');
    }
  }, [lk.toggleScreenShare, ws.send, roomCode, state.myParticipantId, addToast]);

  const handleLeaveConfirm = useCallback(() => {
    dispatch({ type: 'SET_LEAVE_MODAL', show: false });
    ws.send('meeting.leave', { room_code: roomCode, participant_id: state.myParticipantId });
    lk.disconnect();
    ws.disconnect();
    onLeave();
  }, [ws, lk, roomCode, state.myParticipantId, onLeave]);

  const toggleSidebar = useCallback((panel: 'chat' | 'participants') => {
    dispatch({ type: 'TOGGLE_SIDEBAR', panel });
    if (panel === 'chat') room.clearUnread();
    // Keep toolbar visible while sidebar open, restart timer when closed
    clearTimeout(hideTimer.current);
    if (state.sidebarPanel === panel) {
      // Closing sidebar — restart auto-hide
      hideTimer.current = setTimeout(() => dispatch({ type: 'SET_TOOLBAR_VISIBLE', visible: false }), 5000);
    } else {
      dispatch({ type: 'SET_TOOLBAR_VISIBLE', visible: true });
    }
  }, [room.clearUnread, state.sidebarPanel]);

  // ── Build participant data ──
  const localParticipant = useMemo((): Participant | null => {
    const lkLocal = lk.localParticipantInfo;
    if (!lkLocal) return null;
    const wsMe = room.participants.get(state.myParticipantId);
    return {
      id: state.myParticipantId || lkLocal.identity,
      name: lkLocal.name || userName,
      isMuted: lkLocal.isMuted, isCameraOff: lkLocal.isCameraOff,
      isHandRaised: wsMe?.isHandRaised || state.isHandRaised,
      isSpeaking: lkLocal.isSpeaking, isScreenSharing: lkLocal.isScreenSharing,
      isHost: wsMe?.isHost || false, audioLevel: lkLocal.audioLevel,
    };
  }, [lk.localParticipantInfo, room.participants, state.myParticipantId, userName, state.isHandRaised]);

  const remoteParticipants = useMemo((): Participant[] => {
    return Array.from(lk.remoteParticipants.values()).map((rp) => {
      const wsP = Array.from(room.participants.values()).find((p) => p.name === rp.name || p.id === rp.identity);
      return {
        id: rp.identity, name: rp.name, isMuted: rp.isMuted, isCameraOff: rp.isCameraOff,
        isHandRaised: state.raisedHands.has(rp.name) || state.raisedHands.has(rp.identity) || wsP?.isHandRaised || false,
        isSpeaking: rp.isSpeaking, isScreenSharing: rp.isScreenSharing,
        isHost: wsP?.isHost || false, audioLevel: rp.audioLevel, isConnecting: false,
      };
    });
  }, [lk.remoteParticipants, room.participants, state.raisedHands]);

  // Stable stream cache (camera + screen share are separate streams)
  const { remoteStreams, remoteScreenStreams, localStream, localScreenStream } =
    useStreamCache(lk.remoteParticipants, lk.localParticipantInfo);

  const isMuted = lk.localParticipantInfo?.isMuted ?? true;
  const isCameraOff = lk.localParticipantInfo?.isCameraOff ?? true;
  const isScreenSharing = lk.localParticipantInfo?.isScreenSharing || false;
  const totalParticipants = 1 + lk.remoteParticipants.size;

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] relative">
      {state.connectionStatus !== 'connected' && <ConnectionBanner status={state.connectionStatus} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <FloatingReactions reactions={state.floatingReactions} />
      <AudioRenderer remoteParticipants={lk.remoteParticipants} />

      <div className="hidden md:block">
        <Header
          participantCount={totalParticipants} viewMode={state.viewMode}
          onViewModeChange={(vm) => dispatch({ type: 'SET_VIEW_MODE', viewMode: vm })}
          isRecording={recording.isRecording} meetingStartTime={room.meetingStartTime} isE2E={lk.isE2EEEnabled}
        />
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0">
          {state.viewMode === 'grid' ? (
            <VideoGrid participants={remoteParticipants} localParticipant={localParticipant}
              streams={remoteStreams} localStream={localStream}
              screenStreams={remoteScreenStreams} localScreenStream={localScreenStream}
              pinnedId={state.pinnedId}
              isFrontCamera={lk.isFrontCamera} onPin={(id) => dispatch({ type: 'SET_PINNED', id })} />
          ) : (
            <SpeakerView participants={remoteParticipants} localParticipant={localParticipant}
              streams={remoteStreams} localStream={localStream}
              screenStreams={remoteScreenStreams} localScreenStream={localScreenStream}
              pinnedId={state.pinnedId}
              activeSpeakerId={state.activeSpeakerId} isFrontCamera={lk.isFrontCamera}
              onPin={(id) => dispatch({ type: 'SET_PINNED', id })} />
          )}
        </div>

        {state.sidebarPanel && (
          <div className="w-80 border-l border-[var(--border)] bg-[var(--bg-primary)] shrink-0 sidebar-enter">
            {state.sidebarPanel === 'chat' && (
              <ChatPanel messages={room.messages} myId={state.myParticipantId}
                onSend={room.sendChat} onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })} />
            )}
            {state.sidebarPanel === 'participants' && (
              <ParticipantsPanel participants={Array.from(room.participants.values())}
                myId={state.myParticipantId} onClose={() => dispatch({ type: 'CLOSE_SIDEBAR' })} />
            )}
          </div>
        )}
      </div>

      <div className="flex justify-center transition-all duration-300 safe-bottom"
        style={{ opacity: state.toolbarVisible ? 1 : 0, transform: state.toolbarVisible ? 'translateY(0)' : 'translateY(20px)',
          pointerEvents: state.toolbarVisible ? 'auto' : 'none' }}>
        <Toolbar isMuted={isMuted} isCameraOff={isCameraOff} isScreenSharing={isScreenSharing}
          isHandRaised={state.isHandRaised} isChatOpen={state.sidebarPanel === 'chat'}
          isParticipantsOpen={state.sidebarPanel === 'participants'} unreadMessages={room.unreadCount}
          onToggleMute={lk.toggleMicrophone} onToggleCamera={lk.toggleCamera} onFlipCamera={lk.flipCamera}
          onToggleScreenShare={handleToggleScreenShare} onToggleHand={handleToggleHand}
          onReaction={room.sendReaction} onToggleChat={() => toggleSidebar('chat')}
          onToggleParticipants={() => toggleSidebar('participants')}
          onLeave={() => dispatch({ type: 'SET_LEAVE_MODAL', show: true })} />
      </div>

      {state.showLeaveModal && (
        <LeaveConfirmModal onConfirm={handleLeaveConfirm}
          onCancel={() => dispatch({ type: 'SET_LEAVE_MODAL', show: false })} />
      )}
    </div>
  );
}
