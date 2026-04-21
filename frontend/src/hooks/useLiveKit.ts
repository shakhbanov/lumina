import { useRef, useCallback, useState, useEffect } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  LocalParticipant,
  RemoteParticipant,
  LocalTrackPublication,
  LocalVideoTrack,
  ConnectionState,
  Participant,
  VideoPresets,
  ScreenSharePresets,
  ExternalE2EEKeyProvider,
  isE2EESupported,
  type E2EEOptions,
  type VideoEncoding,
} from 'livekit-client';

interface LiveKitParticipantInfo {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  audioLevel: number;
  isScreenSharing: boolean;
  isLocal: boolean;
  videoTrack: MediaStreamTrack | null;
  audioTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  screenAudioTrack: MediaStreamTrack | null;
}

interface UseLiveKitOptions {
  onParticipantJoined?: (identity: string, name: string) => void;
  onParticipantLeft?: (identity: string) => void;
  onActiveSpeakersChanged?: (speakers: string[]) => void;
  onConnectionStateChange?: (state: ConnectionState) => void;
  e2eePassphrase?: string;
}

export function useLiveKit(options: UseLiveKitOptions = {}) {
  const roomRef = useRef<Room | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, LiveKitParticipantInfo>>(new Map());
  const [localParticipantInfo, setLocalParticipantInfo] = useState<LiveKitParticipantInfo | null>(null);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(false);
  const [isNoiseFilterEnabled, setIsNoiseFilterEnabled] = useState(true);
  const keyProviderRef = useRef<ExternalE2EEKeyProvider | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const extractParticipantInfo = useCallback((participant: Participant, isLocal: boolean): LiveKitParticipantInfo => {
    let videoTrack: MediaStreamTrack | null = null;
    let audioTrack: MediaStreamTrack | null = null;
    let screenTrack: MediaStreamTrack | null = null;
    let screenAudioTrack: MediaStreamTrack | null = null;
    let isCameraOff = true;
    let isMuted = true;
    let isScreenSharing = false;

    participant.trackPublications.forEach((pub) => {
      const track = pub.track;
      if (!track) return;

      if (pub.source === Track.Source.Camera) {
        videoTrack = track.mediaStreamTrack;
        isCameraOff = pub.isMuted || !pub.isSubscribed && !isLocal;
      } else if (pub.source === Track.Source.Microphone) {
        audioTrack = track.mediaStreamTrack;
        isMuted = pub.isMuted;
      } else if (pub.source === Track.Source.ScreenShare) {
        screenTrack = track.mediaStreamTrack;
        isScreenSharing = true;
      } else if (pub.source === Track.Source.ScreenShareAudio) {
        screenAudioTrack = track.mediaStreamTrack;
      }
    });

    return {
      identity: participant.identity,
      name: participant.name || participant.identity,
      isSpeaking: participant.isSpeaking,
      isMuted,
      isCameraOff,
      audioLevel: participant.audioLevel,
      isScreenSharing,
      isLocal,
      videoTrack,
      audioTrack,
      screenTrack,
      screenAudioTrack,
    };
  }, []);

  const updateRemoteParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const newMap = new Map<string, LiveKitParticipantInfo>();
    room.remoteParticipants.forEach((rp) => {
      newMap.set(rp.identity, extractParticipantInfo(rp, false));
    });
    setRemoteParticipants(newMap);
  }, [extractParticipantInfo]);

  const updateLocalParticipant = useCallback(() => {
    const room = roomRef.current;
    if (!room?.localParticipant) return;
    setLocalParticipantInfo(extractParticipantInfo(room.localParticipant, true));
  }, [extractParticipantInfo]);

  const connect = useCallback(async (url: string, token: string, previewStream?: MediaStream | null, cameraOn = true, micOn = true) => {
    // Disconnect existing room if any
    if (roomRef.current) {
      await roomRef.current.disconnect();
    }

    // Mobile: 480p, no simulcast, VP8. Desktop: 720p, simulcast, VP8.
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;

    // E2EE setup
    const e2eeEnabled = !!optionsRef.current.e2eePassphrase && isE2EESupported();
    let e2eeOptions: E2EEOptions | undefined;
    if (e2eeEnabled) {
      const keyProvider = new ExternalE2EEKeyProvider();
      keyProviderRef.current = keyProvider;
      await keyProvider.setKey(optionsRef.current.e2eePassphrase!);
      e2eeOptions = {
        keyProvider,
        worker: new Worker(
          new URL('livekit-client/e2ee-worker', import.meta.url),
          { type: 'module' },
        ),
      };
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
      },
      videoCaptureDefaults: {
        resolution: isMobile
          ? { width: 640, height: 480, frameRate: 24 }
          : VideoPresets.h720.resolution,
        facingMode: 'user',
      },
      publishDefaults: {
        simulcast: true,
        videoCodec: 'vp9',
        backupCodec: { codec: 'vp8', encoding: {} as VideoEncoding },
        videoSimulcastLayers: isMobile
          ? [VideoPresets.h180, VideoPresets.h360]
          : [VideoPresets.h180, VideoPresets.h360, VideoPresets.h540],
        videoEncoding: isMobile
          ? { maxBitrate: 800_000, maxFramerate: 24 }
          : { maxBitrate: 1_700_000, maxFramerate: 30 },
        screenShareEncoding: { maxBitrate: 2_500_000, maxFramerate: 15 },
        screenShareSimulcastLayers: [ScreenSharePresets.h720fps15],
        dtx: true,
        red: true,
        degradationPreference: 'balanced',
      },
      ...(e2eeOptions ? { e2ee: e2eeOptions } : {}),
    });

    roomRef.current = room;

    // Connection state
    room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      setConnectionState(state);
      optionsRef.current.onConnectionStateChange?.(state);
    });

    // Participant connected
    room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      console.log(`[LiveKit] Participant joined: ${participant.identity}`);
      optionsRef.current.onParticipantJoined?.(participant.identity, participant.name || participant.identity);
      updateRemoteParticipants();
    });

    // Participant disconnected
    room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      console.log(`[LiveKit] Participant left: ${participant.identity}`);
      optionsRef.current.onParticipantLeft?.(participant.identity);
      updateRemoteParticipants();
    });

    // Track subscribed (remote track available)
    room.on(RoomEvent.TrackSubscribed, (_track, _pub, _participant) => {
      updateRemoteParticipants();
    });

    // Track unsubscribed
    room.on(RoomEvent.TrackUnsubscribed, (_track, _pub, _participant) => {
      updateRemoteParticipants();
    });

    // Track muted/unmuted — only update the affected participant
    room.on(RoomEvent.TrackMuted, (_pub, participant) => {
      if (participant === room.localParticipant) {
        updateLocalParticipant();
      } else {
        updateRemoteParticipants();
      }
    });

    room.on(RoomEvent.TrackUnmuted, (_pub, participant) => {
      if (participant === room.localParticipant) {
        updateLocalParticipant();
      } else {
        updateRemoteParticipants();
      }
    });

    // Local track published
    room.on(RoomEvent.LocalTrackPublished, (_pub: LocalTrackPublication, _participant: LocalParticipant) => {
      updateLocalParticipant();
    });

    room.on(RoomEvent.LocalTrackUnpublished, (_pub: LocalTrackPublication, _participant: LocalParticipant) => {
      updateLocalParticipant();
    });

    // Active speakers — only update speaker list, no re-render of participants
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
      const ids = speakers.map((s) => s.identity);
      setActiveSpeakers(ids);
      optionsRef.current.onActiveSpeakersChanged?.(ids);
    });

    // Audio level changes
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (!room.canPlaybackAudio) {
        room.startAudio().catch(() => {});
      }
    });

    try {
      await room.connect(url, token);
      console.log(`[LiveKit] Connected to room: ${room.name}`);

      // Enable E2EE after connect
      if (e2eeEnabled) {
        await room.setE2EEEnabled(true);
        setIsE2EEEnabled(true);
        console.log('[LiveKit] E2EE enabled');
      }

      if (previewStream) {
        // Publish existing preview tracks directly — no camera re-acquisition delay
        const videoTrack = previewStream.getVideoTracks()[0];
        const audioTrack = previewStream.getAudioTracks()[0];
        const publishPromises: Promise<unknown>[] = [];

        if (videoTrack && cameraOn) {
          publishPromises.push(
            room.localParticipant.publishTrack(videoTrack, {
              source: Track.Source.Camera,
              simulcast: true,
              videoCodec: 'vp9',
              videoEncoding: isMobile
                ? { maxBitrate: 800_000, maxFramerate: 24 }
                : { maxBitrate: 1_700_000, maxFramerate: 30 },
            })
          );
        } else if (videoTrack) {
          videoTrack.stop();
        }

        if (audioTrack && micOn) {
          publishPromises.push(
            room.localParticipant.publishTrack(audioTrack, {
              source: Track.Source.Microphone,
            })
          );
        } else if (audioTrack) {
          audioTrack.stop();
        }

        await Promise.all(publishPromises);
        console.log('[LiveKit] Published preview tracks directly');
      } else {
        if (cameraOn && micOn) {
          await room.localParticipant.enableCameraAndMicrophone();
        } else if (cameraOn) {
          await room.localParticipant.setCameraEnabled(true);
        } else if (micOn) {
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        console.log('[LiveKit] Media enabled');
      }

      console.log('[LiveKit] Browser noise suppression enabled');
      setIsNoiseFilterEnabled(true);

      updateLocalParticipant();
      updateRemoteParticipants();
    } catch (err) {
      console.error('[LiveKit] Connection error:', err);
      throw err;
    }
  }, [updateRemoteParticipants, updateLocalParticipant]);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    if (room) {
      await room.disconnect();
      roomRef.current = null;
      setRemoteParticipants(new Map());
      setLocalParticipantInfo(null);
      setConnectionState(ConnectionState.Disconnected);
      setIsE2EEEnabled(false);
    }
  }, []);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    updateLocalParticipant();
  }, [updateLocalParticipant]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled);
    updateLocalParticipant();
  }, [updateLocalParticipant]);

  const toggleScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return false;
    const enabled = room.localParticipant.isScreenShareEnabled;
    try {
      await room.localParticipant.setScreenShareEnabled(!enabled, {
        audio: true,
        resolution: VideoPresets.h1080.resolution,
        contentHint: 'detail',
      });
      updateLocalParticipant();
      return !enabled;
    } catch (err) {
      // NotAllowedError (user cancelled) is expected; anything else means the
      // feature genuinely failed and the caller should surface it.
      const name = (err as { name?: string })?.name;
      if (name !== 'NotAllowedError' && name !== 'AbortError') {
        console.error('[LiveKit] Screen share failed:', err);
        throw err;
      }
      return enabled;
    }
  }, [updateLocalParticipant]);

  // Flip between front and back camera (mobile)
  const facingModeRef = useRef<'user' | 'environment'>('user');
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const flipCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const newMode = facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = newMode;
    setIsFrontCamera(newMode === 'user');

    try {
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (camPub?.track) {
        await (camPub.track as LocalVideoTrack).restartTrack({
          facingMode: { exact: newMode } as unknown as typeof newMode,
        });
      } else {
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.setCameraEnabled(true, {
          facingMode: newMode,
        });
      }
    } catch {
      // OverconstrainedError — revert
      facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
      setIsFrontCamera(facingModeRef.current === 'user');
      console.warn('[LiveKit] Failed to flip camera');
    }
    updateLocalParticipant();
  }, [updateLocalParticipant]);

  // Toggle browser noise suppression by re-acquiring mic track with updated constraints
  const toggleNoiseFilter = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
    if (!micPub?.track) return;

    const newEnabled = !isNoiseFilterEnabled;
    const constraints: MediaTrackConstraints = {
      noiseSuppression: newEnabled,
      echoCancellation: true,
      autoGainControl: true,
    };

    // Apply constraints directly to the existing track
    try {
      await micPub.track.mediaStreamTrack.applyConstraints(constraints);
      setIsNoiseFilterEnabled(newEnabled);
      console.log(`[LiveKit] Noise suppression ${newEnabled ? 'enabled' : 'disabled'}`);
    } catch {
      console.warn('[LiveKit] Failed to apply noise suppression constraints');
    }
  }, [isNoiseFilterEnabled]);

  const setMicrophoneEnabled = useCallback(async (enabled: boolean) => {
    const room = roomRef.current;
    if (!room) return;
    await room.localParticipant.setMicrophoneEnabled(enabled);
    updateLocalParticipant();
  }, [updateLocalParticipant]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return {
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    flipCamera,
    toggleScreenShare,
    toggleNoiseFilter,
    setMicrophoneEnabled,
    connectionState,
    remoteParticipants,
    localParticipantInfo,
    activeSpeakers,
    isFrontCamera,
    isE2EEEnabled,
    isNoiseFilterEnabled,
    room: roomRef,
  };
}
