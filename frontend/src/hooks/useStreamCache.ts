import { useRef, useMemo } from 'react';

interface TrackInfo {
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenTrack?: MediaStreamTrack | null;
  screenAudioTrack?: MediaStreamTrack | null;
}

interface VideoCacheEntry {
  stream: MediaStream;
  videoId: string;
}

interface ScreenCacheEntry {
  stream: MediaStream;
  videoId: string;
  audioId: string;
}

/**
 * Video streams carry only the video track — audio plays via separate <audio>
 * elements, otherwise Chrome/Safari block autoplay and render a click-to-play
 * overlay on every remote tile. Screen-share tracks are cached separately so a
 * participant can expose both camera and screen simultaneously.
 */
export function useStreamCache(
  remoteParticipants: Map<string, TrackInfo>,
  localInfo: TrackInfo | null,
) {
  const remoteCache = useRef(new Map<string, VideoCacheEntry>());
  const remoteScreenCache = useRef(new Map<string, ScreenCacheEntry>());

  const { remoteStreams, remoteScreenStreams } = useMemo(() => {
    const camMap = new Map<string, MediaStream>();
    const scrMap = new Map<string, MediaStream>();
    const cache = remoteCache.current;
    const scrCache = remoteScreenCache.current;
    const activeIds = new Set<string>();

    remoteParticipants.forEach((rp, identity) => {
      activeIds.add(identity);
      const videoId = rp.videoTrack?.id || '';
      const cached = cache.get(identity);
      if (cached && cached.videoId === videoId) {
        if (cached.stream.getTracks().length > 0) camMap.set(identity, cached.stream);
      } else if (rp.videoTrack) {
        const stream = new MediaStream();
        stream.addTrack(rp.videoTrack);
        cache.set(identity, { stream, videoId });
        camMap.set(identity, stream);
      } else {
        cache.delete(identity);
      }

      const scrVideoId = rp.screenTrack?.id || '';
      const scrAudioId = rp.screenAudioTrack?.id || '';
      const scrCached = scrCache.get(identity);
      if (scrCached && scrCached.videoId === scrVideoId && scrCached.audioId === scrAudioId) {
        if (scrCached.stream.getTracks().length > 0) scrMap.set(identity, scrCached.stream);
      } else if (rp.screenTrack) {
        const stream = new MediaStream();
        stream.addTrack(rp.screenTrack);
        if (rp.screenAudioTrack) stream.addTrack(rp.screenAudioTrack);
        scrCache.set(identity, { stream, videoId: scrVideoId, audioId: scrAudioId });
        scrMap.set(identity, stream);
      } else {
        scrCache.delete(identity);
      }
    });

    for (const id of cache.keys()) if (!activeIds.has(id)) cache.delete(id);
    for (const id of scrCache.keys()) if (!activeIds.has(id)) scrCache.delete(id);

    return { remoteStreams: camMap, remoteScreenStreams: scrMap };
  }, [remoteParticipants]);

  const localCache = useRef<VideoCacheEntry | null>(null);
  const localScreenCache = useRef<ScreenCacheEntry | null>(null);

  const { localStream, localScreenStream } = useMemo(() => {
    let cam: MediaStream | null = null;
    let scr: MediaStream | null = null;

    if (localInfo) {
      const videoId = localInfo.videoTrack?.id || '';
      const cached = localCache.current;
      if (cached && cached.videoId === videoId) {
        cam = cached.stream.getTracks().length > 0 ? cached.stream : null;
      } else if (localInfo.videoTrack) {
        const stream = new MediaStream();
        stream.addTrack(localInfo.videoTrack);
        localCache.current = { stream, videoId };
        cam = stream;
      } else {
        localCache.current = null;
      }

      const scrVideoId = localInfo.screenTrack?.id || '';
      const scrAudioId = localInfo.screenAudioTrack?.id || '';
      const scrCached = localScreenCache.current;
      if (scrCached && scrCached.videoId === scrVideoId && scrCached.audioId === scrAudioId) {
        scr = scrCached.stream.getTracks().length > 0 ? scrCached.stream : null;
      } else if (localInfo.screenTrack) {
        const stream = new MediaStream();
        stream.addTrack(localInfo.screenTrack);
        if (localInfo.screenAudioTrack) stream.addTrack(localInfo.screenAudioTrack);
        localScreenCache.current = { stream, videoId: scrVideoId, audioId: scrAudioId };
        scr = stream;
      } else {
        localScreenCache.current = null;
      }
    }

    return { localStream: cam, localScreenStream: scr };
  }, [localInfo]);

  return { remoteStreams, remoteScreenStreams, localStream, localScreenStream };
}
