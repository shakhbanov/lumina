import { useState, useEffect, memo } from 'react';
import { Shield, Users, LayoutGrid, Monitor, Maximize, Minimize } from 'lucide-react';
import { t } from '../../lib/i18n';
import type { ViewMode } from '../../types';

interface HeaderProps {
  participantCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  isRecording: boolean;
  meetingStartTime: number;
  isE2E: boolean;
}

export const Header = memo(function Header({
  participantCount,
  viewMode,
  onViewModeChange,
  isRecording,
  meetingStartTime,
  isE2E,
}: HeaderProps) {
  const [elapsed, setElapsed] = useState('00:00');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - meetingStartTime) / 1000);
      const mins = Math.floor(diff / 60).toString().padStart(2, '0');
      const secs = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [meetingStartTime]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  }

  return (
    <header className="flex items-center justify-between px-4 py-2 glass border-b border-[var(--border)] safe-top">
      {/* Left: timer + status icons */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-[var(--text-secondary)] font-mono tabular-nums">{elapsed}</span>

        {isE2E && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--accent)]/20" title={t('meeting.e2e')}>
            <Shield className="w-3.5 h-3.5 text-[var(--accent)]" />
          </div>
        )}

        {isRecording && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--danger)]/20" title={t('meeting.recording')}>
            <div className="w-2 h-2 rounded-full bg-[var(--danger)] animate-pulse-red" />
            <span className="text-xs font-medium text-[var(--danger)] hidden sm:inline">{t('meeting.recording')}</span>
          </div>
        )}
      </div>

      {/* Right: participants, view toggle, fullscreen */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Users className="w-4 h-4" />
          <span className="text-sm">{participantCount}</span>
        </div>

        {/* View toggle — segmented control */}
        <div className="flex bg-[var(--bg-tertiary)] rounded-lg p-0.5 ml-1">
          <button
            onClick={() => onViewModeChange('speaker')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition ${
              viewMode === 'speaker' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:text-white'
            }`}
            title={t('meeting.speakerView')}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('meeting.speakerView')}</span>
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition ${
              viewMode === 'grid' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:text-white'
            }`}
            title={t('meeting.gridView')}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('meeting.gridView')}</span>
          </button>
        </div>

        <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition">
          {isFullscreen ? (
            <Minimize className="w-4 h-4 text-[var(--text-secondary)]" />
          ) : (
            <Maximize className="w-4 h-4 text-[var(--text-secondary)]" />
          )}
        </button>
      </div>
    </header>
  );
});
