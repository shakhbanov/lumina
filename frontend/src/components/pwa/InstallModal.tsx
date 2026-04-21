import { useEffect } from 'react';
import { X, Download, Share, Plus, Apple, Smartphone, Monitor } from 'lucide-react';
import { t } from '../../lib/i18n';
import { usePwaInstall } from '../../hooks/usePwaInstall';

interface InstallModalProps {
  open: boolean;
  onClose: () => void;
}

export function InstallModal({ open, onClose }: InstallModalProps) {
  const { platform, installed, canInstallNative, install } = usePwaInstall();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-[var(--bg-secondary)] border border-[var(--border)] sm:rounded-2xl rounded-t-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">{t('install.title')}</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t('install.subtitle')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition shrink-0"
            aria-label={t('install.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {installed ? (
          <div className="flex items-center gap-2 h-12 px-4 rounded-xl bg-[var(--success)]/15 border border-[var(--success)]/30 text-sm">
            <Download className="w-4 h-4 text-[var(--success)] shrink-0" />
            <span>{t('install.installed')}</span>
          </div>
        ) : (
          <div className="space-y-6">
            {platform === 'ios' && <IosSection />}
            {platform === 'android' && (
              <AndroidSection
                canInstallNative={canInstallNative}
                onInstall={install}
              />
            )}
            {platform === 'desktop' && (
              <DesktopSection
                canInstallNative={canInstallNative}
                onInstall={install}
              />
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full h-11 rounded-xl bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] transition text-sm font-medium"
        >
          {t('install.close')}
        </button>
      </div>
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center">
          {icon}
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="space-y-2 pl-1">{children}</div>
    </section>
  );
}

function Step({ num, children }: { num: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-xs font-semibold flex items-center justify-center mt-0.5">
        {num}
      </span>
      <p className="text-[var(--text-secondary)] leading-relaxed">{children}</p>
    </div>
  );
}

function IosSection() {
  return (
    <Section icon={<Apple className="w-4 h-4" />} title={t('install.ios.title')}>
      <Step num={1}>{t('install.ios.step1')}</Step>
      <Step num={2}>
        <span className="inline-flex items-center gap-1.5 align-middle">
          {t('install.ios.step2')}
          <Share className="inline w-3.5 h-3.5 text-[var(--accent)]" />
        </span>
      </Step>
      <Step num={3}>
        <span className="inline-flex items-center gap-1.5 align-middle">
          {t('install.ios.step3')}
          <Plus className="inline w-3.5 h-3.5 text-[var(--accent)]" />
        </span>
      </Step>
      <Step num={4}>{t('install.ios.step4')}</Step>
    </Section>
  );
}

function AndroidSection({
  canInstallNative,
  onInstall,
}: {
  canInstallNative: boolean;
  onInstall: () => Promise<boolean>;
}) {
  return (
    <Section icon={<Smartphone className="w-4 h-4" />} title={t('install.android.title')}>
      <Step num={1}>{t('install.android.step1')}</Step>
      <Step num={2}>{t('install.android.step2')}</Step>
      <Step num={3}>{t('install.android.step3')}</Step>
      {canInstallNative && (
        <button
          onClick={() => { void onInstall(); }}
          className="mt-2 w-full h-11 rounded-xl bg-[var(--accent)] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition"
        >
          <Download className="w-4 h-4" />
          {t('install.button')}
        </button>
      )}
    </Section>
  );
}

function DesktopSection({
  canInstallNative,
  onInstall,
}: {
  canInstallNative: boolean;
  onInstall: () => Promise<boolean>;
}) {
  return (
    <Section icon={<Monitor className="w-4 h-4" />} title={t('install.desktop.title')}>
      <Step num={1}>{t('install.desktop.step1')}</Step>
      <Step num={2}>{t('install.desktop.step2')}</Step>
      {canInstallNative && (
        <button
          onClick={() => { void onInstall(); }}
          className="mt-2 w-full h-11 rounded-xl bg-[var(--accent)] text-white font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition"
        >
          <Download className="w-4 h-4" />
          {t('install.button')}
        </button>
      )}
    </Section>
  );
}
