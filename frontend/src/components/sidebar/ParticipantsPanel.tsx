import { memo, useState, useCallback } from 'react';
import { X, Crown, MicOff, ScreenShare, Link, Check } from 'lucide-react';
import { t } from '../../lib/i18n';
import type { Participant } from '../../types';

interface ParticipantsPanelProps {
  participants: Participant[];
  myId: string;
  onClose: () => void;
}

export const ParticipantsPanel = memo(function ParticipantsPanel({
  participants,
  myId,
  onClose,
}: ParticipantsPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-semibold">
          {t('meeting.participants')} <span className="text-[var(--text-muted)]">({participants.length})</span>
        </h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-hover)]">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Copy link button */}
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <button
          onClick={copyLink}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--accent)] hover:opacity-90 transition text-sm font-medium"
        >
          {copied ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
          {copied ? t('landing.copied') : t('meeting.copyLink')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center text-sm font-bold shrink-0">
              {p.name.charAt(0).toUpperCase()}
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {p.isHost && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                <span className="text-sm font-medium truncate">{p.name}</span>
                {p.id === myId && (
                  <span className="text-xs text-[var(--text-muted)]">{t('meeting.you')}</span>
                )}
              </div>
            </div>

            {/* Status icons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {p.isScreenSharing && <ScreenShare className="w-3.5 h-3.5 text-[var(--accent)]" />}
              {p.isMuted && <MicOff className="w-3.5 h-3.5 text-[var(--danger)]" />}
              {p.isSpeaking && !p.isMuted && (
                <div className="flex items-end gap-0.5 h-3.5">
                  {['bar-1', 'bar-2', 'bar-3'].map((id) => (
                    <div
                      key={id}
                      className="w-0.5 bg-[var(--success)] rounded-full audio-bar"
                      style={{ height: '40%' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
