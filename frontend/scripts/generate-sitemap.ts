/**
 * Regenerates public/sitemap.xml at build time with git-derived <lastmod>.
 *
 * Runs as a "prebuild" step so the generated sitemap is in place when Vite
 * copies the public/ directory into dist/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SITE = 'https://lumina.su';

interface Entry {
  /** URL pathname, e.g. "/" or "/about". */
  path: string;
  /** Source file whose git mtime provides <lastmod>. */
  source: string;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

const entries: Entry[] = [
  { path: '/',        source: 'src/pages/LandingPage.tsx', changefreq: 'weekly',  priority: 1.0 },
  { path: '/about',   source: 'src/pages/AboutPage.tsx',   changefreq: 'monthly', priority: 0.7 },
  { path: '/install', source: 'src/pages/InstallPage.tsx', changefreq: 'monthly', priority: 0.8 },
  { path: '/faq',     source: 'src/pages/FaqPage.tsx',     changefreq: 'weekly',  priority: 0.8 },
  { path: '/privacy', source: 'src/pages/PrivacyPage.tsx', changefreq: 'monthly', priority: 0.5 },
  { path: '/terms',   source: 'src/pages/TermsPage.tsx',   changefreq: 'monthly', priority: 0.5 },
];

function gitLastMod(source: string): string {
  try {
    const iso = execSync(`git log -1 --format=%cI -- ${JSON.stringify(source)}`, {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    if (iso) return iso.slice(0, 10);
  } catch {
    // ignore — fall through to today
  }
  return new Date().toISOString().slice(0, 10);
}

function urlBlock(entry: Entry): string {
  const loc = `${SITE}${entry.path === '/' ? '/' : entry.path}`;
  const enHref = entry.path === '/' ? `${SITE}/?lang=en` : `${SITE}${entry.path}?lang=en`;
  const lastmod = gitLastMod(entry.source);
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority.toFixed(1)}</priority>
    <xhtml:link rel="alternate" hreflang="ru" href="${loc}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enHref}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />
  </url>`;
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(urlBlock).join('\n')}
</urlset>
`;

const outPath = path.join(root, 'public', 'sitemap.xml');
fs.writeFileSync(outPath, xml, 'utf8');
console.log(`[sitemap] Wrote ${entries.length} URLs to public/sitemap.xml`);
