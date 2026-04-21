import { useEffect, useState, useCallback, useRef } from 'react';

interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}

const typeStyles: Record<string, string> = {
  info: 'bg-[var(--bg-tertiary)] border-[var(--border)]',
  success: 'bg-emerald-900/80 border-emerald-700/50',
  warning: 'bg-amber-900/80 border-amber-700/50',
  error: 'bg-red-900/80 border-red-700/50',
};

function ToastEntry({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const elRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let alive = true;
    timerRef.current = setTimeout(() => {
      if (!alive || !elRef.current?.isConnected) { onRemove(toast.id); return; }
      elRef.current.classList.replace('toast-enter', 'toast-exit');
      timerRef.current = setTimeout(() => { if (alive) onRemove(toast.id); }, 160);
    }, toast.duration ?? 3000);
    return () => { alive = false; clearTimeout(timerRef.current); };
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      ref={elRef}
      className={`toast-enter px-4 py-2.5 rounded-xl border text-sm font-medium shadow-lg ${typeStyles[toast.type || 'info']}`}
    >
      {toast.message}
    </div>
  );
}

export function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastEntry key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

/** Hook to manage toast state */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'info', duration = 3000) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
