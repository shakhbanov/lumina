import { memo } from 'react';
import { LogOut } from 'lucide-react';
import { t } from '../../lib/i18n';

interface LeaveConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const LeaveConfirmModal = memo(function LeaveConfirmModal({
  onConfirm,
  onCancel,
}: LeaveConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center modal-overlay"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      onKeyDown={(e) => e.key === 'Escape' && onCancel()}
    >
      <div
        className="modal-content bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <LogOut className="w-6 h-6 text-[var(--danger)]" />
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-1">{t('leave.title')}</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('leave.description')}
            </p>
          </div>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 h-11 rounded-xl bg-[var(--bg-tertiary)] text-sm font-medium hover:bg-[var(--bg-hover)] transition active:scale-95"
            >
              {t('leave.stay')}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 h-11 rounded-xl bg-[var(--danger)] text-white text-sm font-medium hover:brightness-110 transition active:scale-95"
            >
              {t('leave.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
