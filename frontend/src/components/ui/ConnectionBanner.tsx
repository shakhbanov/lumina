import { memo } from 'react';
import { WifiOff, Loader2 } from 'lucide-react';
import { t } from '../../lib/i18n';

interface ConnectionBannerProps {
  status: 'connecting' | 'reconnecting' | 'disconnected';
}

const config = {
  connecting: { bg: 'bg-amber-600/90', icon: Loader2, key: 'connection.connecting', spin: true },
  reconnecting: { bg: 'bg-amber-600/90', icon: Loader2, key: 'connection.reconnecting', spin: true },
  disconnected: { bg: 'bg-red-600/90', icon: WifiOff, key: 'connection.lost', spin: false },
};

export const ConnectionBanner = memo(function ConnectionBanner({ status }: ConnectionBannerProps) {
  const c = config[status];
  const Icon = c.icon;

  return (
    <div className={`banner-slide-down ${c.bg} text-white text-sm font-medium flex items-center justify-center gap-2 py-2 px-4`}>
      <Icon className={`w-4 h-4 ${c.spin ? 'animate-spin' : ''}`} />
      {t(c.key)}
    </div>
  );
});
