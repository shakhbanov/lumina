import { useRef, useCallback, useState, useEffect } from 'react';

export function useRecording() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const start = useCallback(async (): Promise<boolean> => {
    try {
      // Capture tab audio + video
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: true,
      });

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        clearInterval(timerRef.current);
      };

      // Auto-stop if user clicks browser "Stop sharing"
      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      };

      recorder.start(1000); // Collect data every second
      recorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);

      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback((): Blob | null => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return null;

    recorder.stop();
    recorderRef.current = null;
    clearInterval(timerRef.current);

    if (chunksRef.current.length === 0) return null;

    const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
    chunksRef.current = [];
    return blob;
  }, []);

  const toggle = useCallback(async (): Promise<Blob | null> => {
    if (isRecording) {
      return stop();
    } else {
      await start();
      return null;
    }
  }, [isRecording, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop();
      }
      clearInterval(timerRef.current);
    };
  }, []);

  // Format recording time as MM:SS
  const formattedTime = `${Math.floor(recordingTime / 60)
    .toString()
    .padStart(2, '0')}:${(recordingTime % 60).toString().padStart(2, '0')}`;

  return {
    isRecording,
    recordingTime,
    formattedTime,
    toggle,
    start,
    stop,
  };
}
