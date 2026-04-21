import { useCallback, useEffect, useRef, memo } from 'react';
import { MicOff, Hand, Crown, Loader2, MonitorUp } from 'lucide-react';
import { t } from '../../lib/i18n';
import type { Participant } from '../../types';

interface ParticipantTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  screenStream?: MediaStream | null;
  isLocal?: boolean;
  isMirrored?: boolean;
  isPinned?: boolean;
  onDoubleClick?: () => void;
  className?: string;
}

/** Generate a stable hue from a string (for avatar background) */
function nameToHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export const ParticipantTile = memo(function ParticipantTile({
  participant,
  stream,
  screenStream,
  isLocal = false,
  isMirrored = false,
  isPinned = false,
  onDoubleClick,
  className = '',
}: ParticipantTileProps) {
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  // Prefer screen share over camera when present (remote screen sharing is the
  // whole point of the feature, so the tile should show the screen).
  const activeStream = screenStream ?? stream ?? null;
  const isShowingScreen = !!screenStream;

  const videoRefCallback = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && activeStream && el.srcObject !== activeStream) {
      el.srcObject = activeStream;
    }
    // Browsers block autoplay if anything looks off; muting + explicit play()
    // keeps the frame visible instead of a click-to-play overlay.
    el?.play().catch(() => {});
  }, [activeStream]);

  // Re-attach / replay when the stream object changes under the same element.
  useEffect(() => {
    const el = videoElRef.current;
    if (!el) return;
    if (el.srcObject !== activeStream) el.srcObject = activeStream ?? null;
    if (activeStream) el.play().catch(() => {});
  }, [activeStream]);

  // When a remote track's first frames arrive, `MediaStreamTrack.muted` flips
  // from true → false without a React re-render. Listen for that so the avatar
  // placeholder gets replaced by the live video once frames actually flow.
  useEffect(() => {
    if (!activeStream) return;
    const tracks = activeStream.getVideoTracks();
    const el = videoElRef.current;
    const onUnmute = () => el?.play().catch(() => {});
    tracks.forEach((tr) => tr.addEventListener('unmute', onUnmute));
    return () => tracks.forEach((tr) => tr.removeEventListener('unmute', onUnmute));
  }, [activeStream]);

  // Trust LiveKit's signals (participant.isCameraOff / isScreenSharing) rather
  // than MediaStreamTrack.muted — the latter is briefly true on subscribe and
  // never fires a React update, which was leaving the host stuck on avatars.
  const hasCameraVideo = !isLocal ? !participant.isCameraOff : !participant.isCameraOff && !!stream;
  const showVideo = isShowingScreen || hasCameraVideo;
  const isConnecting = participant.isConnecting && !activeStream;

  const avatarHue = nameToHue(participant.name);
  const avatarBg = `hsl(${avatarHue}, 55%, 42%)`;
  const mirror = isMirrored && !isShowingScreen;
  const fit = isShowingScreen ? 'object-contain' : 'object-contain';

  return (
    <div
      className={`video-tile relative group ${isPinned ? 'ring-2 ring-[var(--accent)]' : ''} ${className}`}
      onDoubleClick={onDoubleClick}
    >
      {showVideo ? (
        <video
          ref={videoRefCallback}
          autoPlay
          playsInline
          muted
          className={`w-full h-full ${fit} ${mirror ? '-scale-x-100' : ''}`}
        />
      ) : isConnecting ? (
        <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)] skeleton-pulse">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
            style={{ background: avatarBg }}
          >
            <Loader2 className="w-7 h-7 text-white/70 animate-spin" />
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--bg-secondary)]">
          <div
            className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-2xl md:text-3xl font-bold text-white"
            style={{ background: avatarBg }}
          >
            {participant.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
        <div className="flex items-center gap-1.5">
          {participant.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
          {isShowingScreen && <MonitorUp className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />}
          <span className="text-sm font-medium truncate">
            {participant.name}
            {isLocal && ` ${t('meeting.you')}`}
          </span>
          <div className="flex items-center gap-1 ml-auto shrink-0">
            {participant.isHandRaised && <Hand className="w-3.5 h-3.5 text-yellow-400" />}
            {participant.isMuted && <MicOff className="w-3.5 h-3.5 text-[var(--danger)]" />}
          </div>
        </div>
      </div>

    </div>
  );
});
