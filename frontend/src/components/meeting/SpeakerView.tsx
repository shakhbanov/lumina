import { useMemo, memo, useRef, useState, useCallback, useEffect } from 'react';
import { ParticipantTile } from './ParticipantTile';
import type { Participant } from '../../types';

interface SpeakerViewProps {
  participants: Participant[];
  localParticipant: Participant | null;
  streams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  screenStreams?: Map<string, MediaStream>;
  localScreenStream?: MediaStream | null;
  pinnedId: string | null;
  activeSpeakerId: string | null;
  isFrontCamera?: boolean;
  onPin: (id: string | null) => void;
}

const STRIP_LIMIT = 8;

/** Draggable PiP self-view for mobile — uses CSS transform for smooth GPU-accelerated movement */
function DraggablePiP({
  participant,
  stream,
  isMirrored = true,
}: {
  participant: Participant;
  stream: MediaStream | null;
  isMirrored?: boolean;
}) {
  const pipRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -1, y: -1 });
  const boundsRef = useRef({ maxX: 0, maxY: 0 });
  const dragState = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Initialize default position (bottom-right) and cache bounds
  useEffect(() => {
    const el = pipRef.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    boundsRef.current = { maxX: pr.width - er.width - 8, maxY: pr.height - er.height - 8 };
    const x = pr.width - er.width - 16;
    const y = pr.height - er.height - 16;
    posRef.current = { x, y };
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const el = pipRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);
    // Recalculate bounds on drag start (handles orientation changes)
    const parent = el.parentElement;
    if (parent) {
      const pr = parent.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      boundsRef.current = { maxX: pr.width - er.width - 8, maxY: pr.height - er.height - 8 };
    }
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current || !pipRef.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const { maxX, maxY } = boundsRef.current;
    const x = Math.max(8, Math.min(maxX, dragState.current.origX + dx));
    const y = Math.max(8, Math.min(maxY, dragState.current.origY + dy));
    posRef.current = { x, y };
    pipRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }, []);

  const handlePointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  return (
    <div
      ref={pipRef}
      className="absolute top-0 left-0 w-28 h-40 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 z-10 touch-none will-change-transform"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <ParticipantTile
        participant={participant}
        stream={stream}
        isLocal={true}
        isMirrored={isMirrored}
        isPinned={false}
        className="w-full h-full"
      />
    </div>
  );
}

export const SpeakerView = memo(function SpeakerView({
  participants,
  localParticipant,
  streams,
  localStream,
  screenStreams,
  localScreenStream,
  pinnedId,
  activeSpeakerId,
  isFrontCamera = true,
  onPin,
}: SpeakerViewProps) {
  const allParticipants = useMemo(() => {
    return localParticipant ? [localParticipant, ...participants] : [...participants];
  }, [participants, localParticipant]);

  const isOneOnOne = participants.length === 1;

  // Detect mobile (< 768px)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Main speaker: pinned > screen sharer > first remote (stable for 1:1)
  const mainSpeaker = useMemo(() => {
    if (pinnedId) return allParticipants.find((p) => p.id === pinnedId);
    const screener = allParticipants.find((p) => p.isScreenSharing);
    if (screener) return screener;
    // For 1:1 calls, always show remote (no active speaker jumping)
    if (isOneOnOne && participants[0]) return participants[0];
    if (activeSpeakerId) return allParticipants.find((p) => p.id === activeSpeakerId);
    return participants[0] || localParticipant;
  }, [allParticipants, participants, localParticipant, pinnedId, activeSpeakerId, isOneOnOne]);

  const others = useMemo(() => {
    return allParticipants.filter((p) => p.id !== mainSpeaker?.id);
  }, [allParticipants, mainSpeaker]);

  if (!mainSpeaker) return null;

  const getStream = (p: Participant) =>
    localParticipant && p.id === localParticipant.id ? localStream : streams.get(p.id) || null;
  const getScreen = (p: Participant): MediaStream | null | undefined =>
    localParticipant && p.id === localParticipant.id ? localScreenStream : screenStreams?.get(p.id);

  // Mobile 1:1: WhatsApp-style — full screen remote + draggable PiP self
  if (isOneOnOne && isMobile && localParticipant) {
    return (
      <div className="w-full h-full relative">
        <ParticipantTile
          participant={participants[0]}
          stream={streams.get(participants[0].id) || null}
          screenStream={getScreen(participants[0])}
          isLocal={false}
          isPinned={false}
          className="w-full h-full"
        />
        <DraggablePiP participant={localParticipant} stream={localStream} isMirrored={isFrontCamera} />
      </div>
    );
  }

  // Desktop or group: standard speaker view with strip
  const visibleOthers = others.slice(0, STRIP_LIMIT);
  const hiddenCount = Math.max(0, others.length - STRIP_LIMIT);

  return (
    <div className="w-full h-full flex flex-col md:flex-row gap-2 p-2">
      {/* Main speaker */}
      <div className="flex-1 min-h-0">
        <ParticipantTile
          participant={mainSpeaker}
          stream={getStream(mainSpeaker)}
          screenStream={getScreen(mainSpeaker)}
          isLocal={localParticipant?.id === mainSpeaker.id}
          isMirrored={localParticipant?.id === mainSpeaker.id && isFrontCamera}
          isPinned={pinnedId === mainSpeaker.id}
          onDoubleClick={() => onPin(pinnedId === mainSpeaker.id ? null : mainSpeaker.id)}
          className="w-full h-full"
        />
      </div>

      {/* Thumbnail strip */}
      {others.length > 0 && (
        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto md:w-56 shrink-0 pb-1 md:pb-0">
          {visibleOthers.map((p) => (
            <ParticipantTile
              key={p.id}
              participant={p}
              stream={getStream(p)}
              isLocal={localParticipant?.id === p.id}
              isMirrored={localParticipant?.id === p.id && isFrontCamera}
              isPinned={pinnedId === p.id}
              onDoubleClick={() => onPin(pinnedId === p.id ? null : p.id)}
              className="w-32 h-24 md:w-full md:h-28 shrink-0"
            />
          ))}

          {hiddenCount > 0 && (
            <div className="w-32 h-24 md:w-full md:h-28 shrink-0 rounded-xl bg-[var(--bg-tertiary)] flex items-center justify-center">
              <span className="text-lg font-semibold text-[var(--text-secondary)]">
                +{hiddenCount}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
