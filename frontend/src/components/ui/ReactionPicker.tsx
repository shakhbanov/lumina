import { memo } from 'react';

const REACTIONS = ['👍', '👏', '😂', '❤️', '🎉', '🤔'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Render inline (no backdrop, no absolute positioning) */
  inline?: boolean;
}

export const ReactionPicker = memo(function ReactionPicker({ onSelect, onClose, inline }: ReactionPickerProps) {
  if (inline) {
    return (
      <div className="flex gap-1 flex-wrap">
        {REACTIONS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="w-10 h-10 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-xl transition active:scale-90"
          >
            {emoji}
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Invisible backdrop to close picker */}
      <div className="fixed inset-0 z-40" role="button" tabIndex={-1} onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()} />
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 picker-pop">
        <div className="flex gap-1 px-2 py-1.5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-10 h-10 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-center text-xl transition active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
});
