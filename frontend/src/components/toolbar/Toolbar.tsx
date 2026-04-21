import { memo, useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Camera,
  CameraOff,
  SwitchCamera,
  MonitorUp,
  MessageSquare,
  Users,
  PhoneOff,
  Hand,
  SmilePlus,
  EllipsisVertical,
} from 'lucide-react';
import { t } from '../../lib/i18n';
import { ReactionPicker } from '../ui/ReactionPicker';

interface ToolbarProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  unreadMessages: number;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onFlipCamera?: () => void;
  onToggleScreenShare: () => void;
  onToggleHand: () => void;
  onReaction: (emoji: string) => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeave: () => void;
}

export const Toolbar = memo(function Toolbar({
  isMuted,
  isCameraOff,
  isScreenSharing,
  isHandRaised,
  isChatOpen,
  isParticipantsOpen,
  unreadMessages,
  onToggleMute,
  onToggleCamera,
  onFlipCamera,
  onToggleScreenShare,
  onToggleHand,
  onReaction,
  onToggleChat,
  onToggleParticipants,
  onLeave,
}: ToolbarProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showFlipHint, setShowFlipHint] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const didLongPress = useRef(false);
  const moreRef = useRef<HTMLDivElement>(null);

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

  const handleCameraPointerDown = useCallback(() => {
    didLongPress.current = false;
    if (isMobile && onFlipCamera && !isCameraOff) {
      longPressTimer.current = setTimeout(() => {
        didLongPress.current = true;
        onFlipCamera();
        setShowFlipHint(true);
        setTimeout(() => setShowFlipHint(false), 800);
      }, 500);
    }
  }, [isMobile, onFlipCamera, isCameraOff]);

  const handleCameraPointerUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!didLongPress.current) {
      onToggleCamera();
    }
  }, [onToggleCamera]);

  const handleCameraPointerLeave = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    if (!showMore) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false);
      }
    }
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [showMore]);

  return (
    <div className="flex items-center justify-center gap-1 md:gap-2 px-2.5 py-2 mb-3 rounded-2xl glass border border-[var(--border)] w-fit self-center">
      {/* ── Mic ── */}
      <button
        onClick={onToggleMute}
        className={`toolbar-btn ${isMuted ? 'bg-[var(--danger)]' : 'bg-[var(--bg-tertiary)]'}`}
        title={`${t('meeting.mute')} (Ctrl+D)`}
      >
        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {/* ── Camera (long-press to flip on mobile, context menu prevented) ── */}
      <button
        onPointerDown={handleCameraPointerDown}
        onPointerUp={handleCameraPointerUp}
        onPointerLeave={handleCameraPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        className={`toolbar-btn relative ${isCameraOff ? 'bg-[var(--danger)]' : 'bg-[var(--bg-tertiary)]'}`}
        title={`${t('meeting.camera')} (Ctrl+E)`}
        style={{ touchAction: 'none' }}
      >
        {showFlipHint ? (
          <SwitchCamera className="w-5 h-5" />
        ) : isCameraOff ? (
          <CameraOff className="w-5 h-5" />
        ) : (
          <Camera className="w-5 h-5" />
        )}
      </button>

      {/* ── Screen share (desktop only) ── */}
      <div className="hidden md:block">
        <button
          onClick={onToggleScreenShare}
          className={`toolbar-btn ${isScreenSharing ? 'active' : 'bg-[var(--bg-tertiary)]'}`}
          title={t('meeting.share')}
        >
          <MonitorUp className="w-5 h-5" />
        </button>
      </div>

      <div className="toolbar-divider hidden md:block" />

      {/* ── Hand (desktop only) ── */}
      <div className="hidden md:block">
        <button
          onClick={onToggleHand}
          className={`toolbar-btn ${isHandRaised ? 'bg-amber-500 text-white' : 'bg-[var(--bg-tertiary)]'}`}
          title={`${t('meeting.hand')} (Ctrl+Y)`}
        >
          <Hand className="w-5 h-5" />
        </button>
      </div>

      {/* ── Reactions (desktop only) ── */}
      <div className="relative hidden md:flex">
        <button
          onClick={() => setShowReactions((p) => !p)}
          className="toolbar-btn bg-[var(--bg-tertiary)]"
          title={t('meeting.reaction')}
        >
          <SmilePlus className="w-5 h-5" />
        </button>
        {showReactions && (
          <ReactionPicker
            onSelect={onReaction}
            onClose={() => setShowReactions(false)}
          />
        )}
      </div>

      <div className="toolbar-divider hidden md:block" />

      {/* ── Chat ── */}
      <button
        onClick={onToggleChat}
        className={`toolbar-btn relative ${isChatOpen ? 'active' : 'bg-[var(--bg-tertiary)]'}`}
        title={t('meeting.chat')}
      >
        <MessageSquare className="w-5 h-5" />
        {unreadMessages > 0 && !isChatOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--danger)] text-[10px] font-bold flex items-center justify-center">
            {unreadMessages > 9 ? '9+' : unreadMessages}
          </span>
        )}
      </button>

      {/* ── Participants (desktop only) ── */}
      <div className="hidden md:block">
        <button
          onClick={onToggleParticipants}
          className={`toolbar-btn ${isParticipantsOpen ? 'active' : 'bg-[var(--bg-tertiary)]'}`}
          title={t('meeting.participants')}
        >
          <Users className="w-5 h-5" />
        </button>
      </div>

      {/* ── More menu (mobile/tablet only) ── */}
      <div className="relative md:hidden" ref={moreRef}>
        <button
          onClick={() => setShowMore((p) => !p)}
          className={`toolbar-btn ${showMore ? 'active' : 'bg-[var(--bg-tertiary)]'}`}
          title={t('meeting.more')}
        >
          <EllipsisVertical className="w-5 h-5" />
          {isHandRaised && !showMore && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-500" />
          )}
        </button>

        {showMore && (
          <div className="absolute bottom-full mb-2 right-0 min-w-[180px] py-1.5 rounded-xl border border-[var(--border)] shadow-lg overflow-hidden"
            style={{ background: 'rgba(10, 10, 10, 0.95)' }}
          >
            {/* Hand raise */}
            <button
              onClick={() => { onToggleHand(); setShowMore(false); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition"
            >
              <Hand className={`w-4 h-4 ${isHandRaised ? 'text-amber-500' : ''}`} />
              <span>{t('meeting.hand')}</span>
              {isHandRaised && <span className="ml-auto text-xs text-amber-500">✓</span>}
            </button>

            {/* Reactions */}
            <button
              onClick={() => setShowReactions((p) => !p)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition"
            >
              <SmilePlus className="w-4 h-4" />
              <span>{t('meeting.reaction')}</span>
            </button>

            {/* Participants */}
            <button
              onClick={() => { onToggleParticipants(); setShowMore(false); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition"
            >
              <Users className={`w-4 h-4 ${isParticipantsOpen ? 'text-[var(--accent)]' : ''}`} />
              <span>{t('meeting.participants')}</span>
            </button>

            {/* Reaction picker inside overflow menu */}
            {showReactions && (
              <div className="px-3 py-2 border-t border-[var(--border)]">
                <ReactionPicker
                  onSelect={(emoji) => { onReaction(emoji); setShowReactions(false); setShowMore(false); }}
                  onClose={() => setShowReactions(false)}
                  inline
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-divider" />

      {/* ── Leave ── */}
      <button onClick={onLeave} className="leave-btn">
        <PhoneOff className="w-5 h-5" />
        <span className="hidden md:inline">{t('meeting.leave')}</span>
      </button>
    </div>
  );
});
