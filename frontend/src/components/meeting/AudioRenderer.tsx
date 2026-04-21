import { memo, useEffect, useRef } from 'react';

interface TrackInfo {
  audioTrack: MediaStreamTrack | null;
  screenAudioTrack?: MediaStreamTrack | null;
}

interface AudioRendererProps {
  remoteParticipants: Map<string, TrackInfo>;
}

/**
 * Hidden <audio> elements for every remote participant. The camera <video>
 * tiles are always muted (so browser autoplay policy doesn't block them and
 * show a click-to-play overlay), which means we need a separate path for
 * hearing people — this is it.
 */
export const AudioRenderer = memo(function AudioRenderer({ remoteParticipants }: AudioRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const seen = new Set<string>();
    remoteParticipants.forEach((rp, identity) => {
      const tracks: MediaStreamTrack[] = [];
      if (rp.audioTrack) tracks.push(rp.audioTrack);
      if (rp.screenAudioTrack) tracks.push(rp.screenAudioTrack);

      tracks.forEach((track, idx) => {
        const key = `${identity}:${idx}:${track.id}`;
        seen.add(key);
        let el = elementsRef.current.get(key);
        if (!el) {
          el = document.createElement('audio');
          el.autoplay = true;
          el.setAttribute('playsinline', 'true');
          const stream = new MediaStream();
          stream.addTrack(track);
          el.srcObject = stream;
          container.appendChild(el);
          elementsRef.current.set(key, el);
        }
        el.play().catch(() => {});
      });
    });

    // Tear down elements for tracks that are gone.
    for (const [key, el] of elementsRef.current) {
      if (!seen.has(key)) {
        el.srcObject = null;
        el.remove();
        elementsRef.current.delete(key);
      }
    }
  }, [remoteParticipants]);

  useEffect(() => {
    const els = elementsRef.current;
    return () => {
      els.forEach((el) => {
        el.srcObject = null;
        el.remove();
      });
      els.clear();
    };
  }, []);

  return <div ref={containerRef} aria-hidden className="hidden" />;
});
