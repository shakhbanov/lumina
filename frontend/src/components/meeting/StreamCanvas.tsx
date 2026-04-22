import { useEffect, useMemo, useRef } from 'react';

interface StreamCanvasProps {
  stream: MediaStream | null;
  mirror?: boolean;
  fit?: 'cover' | 'contain';
  className?: string;
}

// Renders a MediaStream onto a <canvas>. The decoding <video> is created in
// memory and never attached to the DOM, so iOS Safari has no element on which
// to draw its native "tap to play" / pause overlay. That overlay is rendered
// inside the UA shadow-DOM of an in-tree <video>, which we avoid entirely.
//
// Aspect-fit is implemented manually via drawImage src/dst rects. Mirror is a
// plain CSS transform on the canvas — safe because canvas has no shadow DOM.
export function StreamCanvas({
  stream,
  mirror = false,
  fit = 'cover',
  className = '',
}: StreamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const video = useMemo(() => {
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', 'true');
    return v;
  }, []);

  // Attach the stream to the detached video. Strip audio tracks — unused here
  // (audio is routed through <audio> in AudioRenderer) and a safety belt in
  // case anything ever re-introduces a DOM-attached <video>.
  useEffect(() => {
    if (!stream) {
      video.srcObject = null;
      return;
    }
    const videoOnly = stream.getAudioTracks().length > 0
      ? new MediaStream(stream.getVideoTracks())
      : stream;
    if (video.srcObject !== videoOnly) video.srcObject = videoOnly;
    video.play().catch(() => {});
  }, [stream, video]);

  // iOS pauses backgrounded videos — resume when the tab comes back so frames
  // keep flowing to the canvas.
  useEffect(() => {
    const replay = () => {
      if (video.srcObject && video.paused) video.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', replay);
    window.addEventListener('focus', replay);
    window.addEventListener('pageshow', replay);
    return () => {
      document.removeEventListener('visibilitychange', replay);
      window.removeEventListener('focus', replay);
      window.removeEventListener('pageshow', replay);
    };
  }, [video]);

  // Draw loop. Prefer requestVideoFrameCallback (driven by real decoder ticks)
  // and fall back to requestAnimationFrame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let vfcId: number | undefined;
    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;

      if (vw > 0 && vh > 0 && cw > 0 && ch > 0) {
        // Keep the backing store at the displayed size (DPR-aware) so the
        // drawn image stays crisp without wasting pixels on the source.
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(cw * dpr);
        const targetH = Math.round(ch * dpr);
        if (canvas.width !== targetW) canvas.width = targetW;
        if (canvas.height !== targetH) canvas.height = targetH;

        const srcAspect = vw / vh;
        const dstAspect = targetW / targetH;

        let sx = 0;
        let sy = 0;
        let sW = vw;
        let sH = vh;
        let dx = 0;
        let dy = 0;
        let dW = targetW;
        let dH = targetH;

        if (fit === 'cover') {
          if (srcAspect > dstAspect) {
            // Source wider than dst — crop horizontally.
            sW = vh * dstAspect;
            sx = (vw - sW) / 2;
          } else {
            sH = vw / dstAspect;
            sy = (vh - sH) / 2;
          }
        } else {
          // contain: letterbox
          ctx.clearRect(0, 0, targetW, targetH);
          if (srcAspect > dstAspect) {
            dH = Math.round(targetW / srcAspect);
            dy = Math.round((targetH - dH) / 2);
          } else {
            dW = Math.round(targetH * srcAspect);
            dx = Math.round((targetW - dW) / 2);
          }
        }

        try {
          ctx.drawImage(video, sx, sy, sW, sH, dx, dy, dW, dH);
        } catch {
          // drawImage can throw briefly while the decoder is in an
          // intermediate state (e.g., track just swapped). Skip this frame.
        }
      }

      if (typeof video.requestVideoFrameCallback === 'function') {
        vfcId = video.requestVideoFrameCallback(draw);
      } else {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (vfcId !== undefined && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(vfcId);
      }
    };
  }, [video, fit]);

  // Unmount cleanup for the detached video itself.
  useEffect(() => {
    return () => {
      video.pause();
      video.srcObject = null;
    };
  }, [video]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`${className} pointer-events-none select-none ${mirror ? '-scale-x-100' : ''}`}
    />
  );
}
