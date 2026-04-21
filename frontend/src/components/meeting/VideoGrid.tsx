import { useState, useMemo, useRef, memo, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ParticipantTile } from './ParticipantTile';
import type { Participant } from '../../types';

interface VideoGridProps {
  participants: Participant[];
  localParticipant: Participant | null;
  streams: Map<string, MediaStream>;
  localStream: MediaStream | null;
  screenStreams?: Map<string, MediaStream>;
  localScreenStream?: MediaStream | null;
  pinnedId: string | null;
  isFrontCamera?: boolean;
  onPin: (id: string | null) => void;
}

/** Compute how many tiles fit based on viewport */
function usePageSize(): number {
  const [size, setSize] = useState(() => {
    if (typeof window === 'undefined') return 9;
    const w = window.innerWidth;
    if (w < 640) return 4;   // mobile: 2x2
    if (w < 1280) return 9;  // tablet/laptop: 3x3
    return 16;               // wide: 4x4
  });

  useEffect(() => {
    const calc = () => setSize(window.innerWidth < 640 ? 4 : window.innerWidth < 1280 ? 9 : 16);
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  return size;
}

/** PiP wrapper with long-press to swap */
function PipOverlay({ onSwap, children }: { onSwap: () => void; children: React.ReactNode }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const didLongPress = useRef(false);

  const start = () => {
    didLongPress.current = false;
    timer.current = setTimeout(() => {
      didLongPress.current = true;
      onSwap();
    }, 400);
  };
  const cancel = () => clearTimeout(timer.current);

  return (
    <div
      role="button"
      tabIndex={-1}
      className="absolute top-3 right-3 w-28 h-40 rounded-xl overflow-hidden shadow-lg border-2 border-white/20 z-10"
      onTouchStart={start}
      onTouchEnd={cancel}
      onTouchCancel={cancel}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onKeyDown={(e) => { if (e.key === 'Enter') onSwap(); }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  );
}

export const VideoGrid = memo(function VideoGrid({
  participants,
  localParticipant,
  streams,
  localStream,
  screenStreams,
  localScreenStream,
  pinnedId,
  isFrontCamera = true,
  onPin,
}: VideoGridProps) {
  const getScreen = (p: Participant): MediaStream | null | undefined =>
    localParticipant && p.id === localParticipant.id ? localScreenStream : screenStreams?.get(p.id);
  const [page, setPage] = useState(0);
  const [pipSwapped, setPipSwapped] = useState(false);
  const pageSize = usePageSize();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  // Combine local + remote, pinned first
  const allParticipants = useMemo(() => {
    const all = localParticipant ? [localParticipant, ...participants] : [...participants];
    if (pinnedId) {
      const idx = all.findIndex((p) => p.id === pinnedId);
      if (idx > 0) {
        const [pinned] = all.splice(idx, 1);
        all.unshift(pinned);
      }
    }
    return all;
  }, [participants, localParticipant, pinnedId]);

  const totalPages = Math.max(1, Math.ceil(allParticipants.length / pageSize));
  const currentPage = Math.min(page, totalPages - 1);
  const pageParticipants = allParticipants.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );

  // Reset page when participant count drops
  useEffect(() => {
    if (page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [totalPages, page]);

  const count = pageParticipants.length;
  const total = allParticipants.length;

  // Adaptive grid columns
  let gridClass: string;
  if (total === 1) {
    // Solo — centered, constrained
    gridClass = 'grid-cols-1 max-w-3xl mx-auto';
  } else if (total === 2) {
    // 1:1 — two columns, peer larger on desktop
    gridClass = 'grid-cols-1 sm:grid-cols-2';
  } else if (count <= 4) {
    gridClass = 'grid-cols-2';
  } else if (count <= 6) {
    gridClass = 'grid-cols-2 md:grid-cols-3';
  } else if (count <= 9) {
    gridClass = 'grid-cols-2 md:grid-cols-3';
  } else {
    gridClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }

  // Mobile 1:1 call — fullscreen + PiP layout
  if (isMobile && total === 2 && localParticipant && participants.length === 1) {
    const remote = participants[0];
    const mainP = pipSwapped ? localParticipant : remote;
    const pipP = pipSwapped ? remote : localParticipant;
    const mainStream = pipSwapped ? localStream : (streams.get(remote.id) || null);
    const pipStream = pipSwapped ? (streams.get(remote.id) || null) : localStream;
    const mainMirrored = pipSwapped && isFrontCamera;
    const pipMirrored = !pipSwapped && isFrontCamera;

    return (
      <div className="relative w-full h-full">
        {/* Fullscreen main */}
        <ParticipantTile
          participant={mainP}
          stream={mainStream}
          screenStream={getScreen(mainP)}
          isLocal={mainP.id === localParticipant.id}
          isMirrored={mainMirrored}
          className="w-full h-full"
        />
        {/* PiP overlay — double tap to swap */}
        <PipOverlay onSwap={() => setPipSwapped((s) => !s)}>
          <ParticipantTile
            participant={pipP}
            stream={pipStream}
            screenStream={getScreen(pipP)}
            isLocal={pipP.id === localParticipant.id}
            isMirrored={pipMirrored}
            className="w-full h-full"
          />
        </PipOverlay>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className={`flex-1 grid ${gridClass} gap-2 p-2 grid-page`} key={currentPage}>
        {pageParticipants.map((p) => (
          <ParticipantTile
            key={p.id}
            participant={p}
            stream={
              localParticipant && p.id === localParticipant.id
                ? localStream
                : streams.get(p.id) || null
            }
            screenStream={getScreen(p)}
            isLocal={localParticipant?.id === p.id}
            isMirrored={localParticipant?.id === p.id && isFrontCamera}
            isPinned={pinnedId === p.id}
            onDoubleClick={() => onPin(pinnedId === p.id ? null : p.id)}
            className="min-h-0"
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 py-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-30 transition active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-[var(--text-secondary)] tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="p-1 rounded-lg hover:bg-[var(--bg-hover)] disabled:opacity-30 transition active:scale-90"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
});
