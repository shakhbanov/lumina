import { memo } from 'react';
import type { FloatingReaction } from '../../hooks/useMeetingReducer';

interface FloatingReactionsProps {
  reactions: FloatingReaction[];
}

export const FloatingReactions = memo(function FloatingReactions({ reactions }: FloatingReactionsProps) {
  if (reactions.length === 0) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {reactions.map((r) => (
        <div key={r.id} className="absolute left-1/2 -translate-x-1/2 reaction-bubble flex flex-col items-center">
          <span className="text-5xl">{r.emoji}</span>
          {r.name && <span className="text-sm text-white font-medium mt-1 bg-black/50 px-2 py-0.5 rounded-full">{r.name}</span>}
        </div>
      ))}
    </div>
  );
});
