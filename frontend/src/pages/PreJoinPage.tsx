import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, CameraOff, Mic, MicOff, ArrowRight } from 'lucide-react';
import { t, getLocale } from '../lib/i18n';
import { stashStream } from '../lib/stream-store';
import { StreamCanvas } from '../components/meeting/StreamCanvas';

const FUNNY_NAMES_RU = [
  'Амурский тигр', 'Морской котик', 'Снежный барс', 'Уссурийский ёжик',
  'Эльбрусский суслик', 'Байкальская нерпа', 'Чукотский песец', 'Кавказский тур',
  'Тянь-шаньский медведь', 'Алтайский марал', 'Даурский журавль', 'Каспийский тюлень',
  'Камчатский краб', 'Сахалинский лосось', 'Таёжный соболь', 'Полярная сова',
  'Степной орёл', 'Сибирский бурундук', 'Уральский филин', 'Курильский бобр',
  'Арктический песец', 'Забайкальский манул', 'Тундровый лемминг', 'Ангарская выдра',
  'Енисейский осётр', 'Волжский судак', 'Крымский геккон', 'Донской скакун',
  'Онежский лебедь', 'Ладожская нерпа', 'Печорский лось', 'Якутский мамонт',
];

const FUNNY_NAMES_EN = [
  'Arctic Fox', 'Snow Leopard', 'Sea Otter', 'Mountain Eagle',
  'Polar Bear', 'Desert Hawk', 'Forest Wolf', 'River Dolphin',
  'Steppe Lynx', 'Coral Seahorse', 'Thunder Falcon', 'Crystal Owl',
  'Shadow Panther', 'Silver Moose', 'Golden Crane', 'Jade Turtle',
  'Storm Raven', 'Amber Elk', 'Frost Heron', 'Copper Badger',
  'Iron Bison', 'Marble Swan', 'Velvet Mink', 'Cobalt Shark',
  'Bronze Cobra', 'Scarlet Macaw', 'Ivory Pelican', 'Onyx Jaguar',
  'Emerald Gecko', 'Sapphire Whale', 'Ruby Flamingo', 'Topaz Mammoth',
];

function generateFunnyName(takenNames?: Set<string>): string {
  const names = getLocale() === 'ru' ? FUNNY_NAMES_RU : FUNNY_NAMES_EN;
  const shuffled = [...names].sort(() => Math.random() - 0.5);
  const available = shuffled.find((n) => !takenNames?.has(n));
  if (available) return available;
  return `${shuffled[0]} ${Math.floor(Math.random() * 99) + 1}`;
}

interface PreJoinPageProps {
  onJoin?: (name: string, cameraOn: boolean, micOn: boolean) => void;
}

export function PreJoinPage({ onJoin }: PreJoinPageProps = {}) {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const streamRef = useRef<MediaStream | null>(null);

  const [name, setName] = useState(() => localStorage.getItem('lumina-name') || '');
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [error, setError] = useState('');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  // Get camera preview — acquire once, toggle via track.enabled
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mob = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: mob ? 640 : 1280 },
              height: { ideal: mob ? 480 : 720 },
              frameRate: { ideal: mob ? 24 : 30 },
              facingMode: 'user',
            },
            audio: true,
          });
        } catch {
          // Fallback: no specific constraints
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        // Apply initial toggle states
        stream.getVideoTracks().forEach((t) => (t.enabled = cameraOn));
        stream.getAudioTracks().forEach((t) => (t.enabled = micOn));
        setPreviewStream(stream);
      } catch {
        // Camera/mic not available
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []); // acquire once, no re-acquisition on toggle

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => {
      const next = !prev;
      streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  const toggleMic = useCallback(() => {
    setMicOn((prev) => {
      const next = !prev;
      streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
      return next;
    });
  }, []);

  async function handleJoin() {
    let finalName = name.trim();
    if (!finalName) {
      finalName = generateFunnyName();
    }
    localStorage.setItem('lumina-name', finalName);
    // Pass stream to MeetingRoom instead of stopping it
    if (streamRef.current) {
      stashStream(streamRef.current);
      streamRef.current = null; // prevent cleanup from stopping it
    }
    if (onJoin) {
      onJoin(finalName, cameraOn, micOn);
    } else {
      navigate(`/room/${code}`, {
        state: { name: finalName, cameraOn, micOn },
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 safe-top safe-bottom">
      <div className="w-full max-w-lg space-y-6">
        <h2 className="text-2xl font-bold text-center">{t('prejoin.title')}</h2>
        <p className="text-center text-[var(--text-secondary)] text-sm">
          {t('prejoin.room')} <span className="font-mono text-white">{code}</span>
        </p>

        {/* Video preview */}
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--border)]">
          {cameraOn && (
            <StreamCanvas
              stream={previewStream}
              mirror
              fit="cover"
              className="w-full h-full"
            />
          )}
          {!cameraOn && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-[var(--text-muted)]" />
              </div>
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={toggleMic}
              className={`toolbar-btn ${micOn ? 'bg-[var(--bg-tertiary)]' : 'bg-[var(--danger)]'}`}
            >
              {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleCamera}
              className={`toolbar-btn ${cameraOn ? 'bg-[var(--bg-tertiary)]' : 'bg-[var(--danger)]'}`}
            >
              {cameraOn ? <Camera className="w-5 h-5" /> : <CameraOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Name input */}
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            {t('prejoin.name')}
          </label>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder={t('prejoin.nameHint')}
            maxLength={30}
            className="w-full h-12 px-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]
              text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition"
          />
        </div>

        {error && <p className="text-[var(--danger)] text-sm text-center">{error}</p>}

        <button
          onClick={handleJoin}
          className="w-full h-14 rounded-2xl bg-[var(--accent)] text-white font-semibold text-lg
            flex items-center justify-center gap-2 hover:brightness-110 transition disabled:opacity-50"
        >
          {t('prejoin.join')}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
