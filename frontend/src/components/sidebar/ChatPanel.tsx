import { useState, useRef, useEffect, memo } from 'react';
import { Send, X } from 'lucide-react';
import { Markdown } from '../../lib/markdown';
import { t, getLocale } from '../../lib/i18n';
import type { ChatMessage } from '../../types';

interface ChatPanelProps {
  messages: ChatMessage[];
  myId: string;
  onSend: (content: string) => void;
  onClose: () => void;
}

export const ChatPanel = memo(function ChatPanel({
  messages,
  myId,
  onSend,
  onClose,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = '40px';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, [input]);

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-semibold">{t('chat.title')}</h3>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--bg-hover)] transition active:scale-90">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[var(--text-muted)] text-sm">{t('chat.empty')}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-xs text-[var(--text-muted)] mb-0.5">{msg.senderName}</span>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm break-words ${
                  isMe
                    ? 'bg-[var(--accent)] text-white rounded-br-md'
                    : 'bg-[var(--bg-tertiary)] rounded-bl-md'
                }`}
              >
                <Markdown text={msg.content} />
              </div>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {new Date(msg.timestamp).toLocaleTimeString(getLocale(), {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--border)]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            maxLength={2000}
            rows={1}
            className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]
              text-sm text-white placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="h-10 w-10 shrink-0 rounded-xl bg-[var(--accent)] flex items-center justify-center
              hover:brightness-110 transition disabled:opacity-30 active:scale-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
