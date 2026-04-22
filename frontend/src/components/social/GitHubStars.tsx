import { useEffect, useState } from 'react';
import { Star, Github } from 'lucide-react';

const REPO = 'shakhbanov/lumina';
const REPO_URL = `https://github.com/${REPO}`;
const API_URL = `https://api.github.com/repos/${REPO}`;
const CACHE_KEY = `lumina:gh-stars:${REPO}`;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  count: number;
  t: number;
}

function readCache(): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.count;
  } catch {
    return null;
  }
}

function writeCache(count: number) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ count, t: Date.now() } satisfies CacheEntry));
  } catch {
    /* quota/permissions — ignore */
  }
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return `${Math.round(n / 1000)}k`;
}

interface Props {
  /** Compact mode: icon + count only (for tight nav bars). */
  compact?: boolean;
  /** Extra className passed to the anchor. */
  className?: string;
}

export function GitHubStars({ compact = false, className = '' }: Props) {
  const [count, setCount] = useState<number | null>(() => readCache());

  useEffect(() => {
    // Use cache if fresh; otherwise refetch in the background.
    if (count !== null) return;
    let cancelled = false;
    fetch(API_URL, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { stargazers_count?: number }) => {
        if (cancelled) return;
        if (typeof data.stargazers_count === 'number') {
          setCount(data.stargazers_count);
          writeCache(data.stargazers_count);
        }
      })
      .catch(() => {
        /* offline / rate-limited — render fallback without count */
      });
    return () => {
      cancelled = true;
    };
  }, [count]);

  const label = count === null ? 'GitHub' : `GitHub · ${formatCount(count)} ★`;

  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className={
        `inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/60 hover:border-[var(--accent)] hover:text-white transition text-sm ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${className}`
      }
    >
      <Github className="w-4 h-4" aria-hidden="true" />
      {!compact && <span className="font-medium">GitHub</span>}
      <span className="inline-flex items-center gap-0.5 text-[var(--text-secondary)]">
        <Star className="w-3.5 h-3.5 fill-current text-[var(--accent)]" aria-hidden="true" />
        <span className="tabular-nums">{count === null ? '—' : formatCount(count)}</span>
      </span>
    </a>
  );
}
