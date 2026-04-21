import React, { memo } from 'react';

/**
 * Lightweight inline markdown renderer.
 * Supports: **bold**, *italic*, `inline code`, ~~strikethrough~~,
 * ```code blocks```, [links](url), and newlines.
 */

interface MarkdownProps {
  text: string;
  className?: string;
}

const ALLOWED_SCHEMES = ['http:', 'https:', 'mailto:'];

function sanitizeUrl(raw: string): string | null {
  // Protocol-relative URLs are fine — they inherit https on a secure page.
  if (raw.startsWith('//')) return `https:${raw}`;
  // Relative URLs (no scheme) are also OK.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) return raw;
  try {
    const parsed = new URL(raw, window.location.origin);
    return ALLOWED_SCHEMES.includes(parsed.protocol.toLowerCase()) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function parseInline(text: string): (string | React.ReactElement)[] {
  const result: (string | React.ReactElement)[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    // Inline code: `...`
    if (text[i] === '`' && text[i + 1] !== '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        result.push(
          <code key={key++} className="px-1 py-0.5 rounded bg-white/10 text-[var(--accent)] text-xs font-mono">
            {text.slice(i + 1, end)}
          </code>
        );
        i = end + 1;
        continue;
      }
    }

    // Bold: **...**
    if (text[i] === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        result.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }

    // Italic: *...*
    if (text[i] === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1 && text[end + 1] !== '*') {
        result.push(<em key={key++}>{text.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }

    // Strikethrough: ~~...~~
    if (text[i] === '~' && text[i + 1] === '~') {
      const end = text.indexOf('~~', i + 2);
      if (end !== -1) {
        result.push(<del key={key++} className="opacity-60">{text.slice(i + 2, end)}</del>);
        i = end + 2;
        continue;
      }
    }

    // Link: [text](url) — scheme-restricted to prevent javascript:/data: XSS.
    if (text[i] === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      if (closeBracket !== -1 && text[closeBracket + 1] === '(') {
        const closeParen = text.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const linkText = text.slice(i + 1, closeBracket);
          const rawUrl = text.slice(closeBracket + 2, closeParen).trim();
          const safeUrl = sanitizeUrl(rawUrl);
          if (safeUrl) {
            result.push(
              <a
                key={key++}
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] underline hover:brightness-125"
              >
                {linkText}
              </a>
            );
          } else {
            // Render the label as plain text when the URL is not on the
            // allow-list — don't silently drop the text.
            result.push(<span key={key++}>{linkText}</span>);
          }
          i = closeParen + 1;
          continue;
        }
      }
    }

    // Plain character
    result.push(text[i]);
    i++;
  }

  // Merge consecutive strings
  const merged: (string | React.ReactElement)[] = [];
  for (const item of result) {
    if (typeof item === 'string' && typeof merged[merged.length - 1] === 'string') {
      merged[merged.length - 1] = (merged[merged.length - 1] as string) + item;
    } else {
      merged.push(item);
    }
  }
  return merged;
}

export const Markdown = memo(function Markdown({ text, className = '' }: MarkdownProps) {
  // Split by code blocks first: ```...```
  const parts = text.split(/(```[\s\S]*?```)/g);

  const elements: React.ReactElement[] = [];
  let key = 0;

  for (const part of parts) {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Code block
      const code = part.slice(3, -3).replace(/^\w*\n/, ''); // remove optional language tag
      elements.push(
        <pre
          key={key++}
          className="my-1 px-2 py-1.5 rounded-lg bg-white/5 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words"
        >
          {code}
        </pre>
      );
    } else {
      // Process line by line for inline markdown
      const lines = part.split('\n');
      lines.forEach((line, li) => {
        if (line) {
          elements.push(<span key={key++}>{parseInline(line)}</span>);
        }
        if (li < lines.length - 1) {
          elements.push(<br key={key++} />);
        }
      });
    }
  }

  return <span className={className}>{elements}</span>;
});
