/**
 * Build-time prerender for Lumina. After `vite build` produces dist/,
 * this script:
 *   1. Runs an SSR Vite build of src/entry-server.tsx into dist-ssr/
 *   2. Imports that bundle, iterates over every route in `routes`
 *   3. Renders each route with StaticRouter + renderToString
 *   4. Rewrites dist/index.html's <head> per-route (title, description,
 *      canonical, OG/Twitter, hreflang, extra JSON-LD) and injects the
 *      rendered React HTML into <div id="root">
 *   5. Writes each route to dist/<path>/index.html
 *
 * Why: React SPA without prerender serves an empty shell to crawlers that
 * don't execute JS (ClaudeBot, PerplexityBot, much of Yandex's first-pass
 * ranking queue). Prerender bakes the real H1/H2 content and per-route
 * meta into the initial HTML payload so those crawlers index real content.
 */

import { build as viteBuild } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { PageMeta } from '../src/components/seo/Meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');
const entryServer = 'src/entry-server.tsx';

const SITE = 'https://lumina.su';

async function ssrBuild() {
  await viteBuild({
    root,
    logLevel: 'warn',
    build: {
      ssr: entryServer,
      outDir: 'dist-ssr',
      emptyOutDir: true,
      rollupOptions: {
        input: entryServer,
        output: {
          format: 'esm',
          entryFileNames: 'entry-server.mjs',
          // @ts-expect-error — codeSplitting is Rolldown-only, not in Vite types yet.
          codeSplitting: false,
        },
      },
    },
    ssr: {
      noExternal: ['lucide-react', 'react-router-dom'],
    },
  });
}

function applyMeta(template: string, meta: PageMeta, bodyHtml: string, ogType: 'website' | 'article' = 'website'): string {
  const image = meta.ogImage ?? `${SITE}/og-image.png`;
  const jsonLdArray = meta.jsonLd ? (Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd]) : [];

  let html = template;

  // <title>
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`);

  // name="description"
  html = html.replace(
    /<meta\s+name="description"[^>]*>/,
    `<meta name="description" content="${escapeAttr(meta.description)}" />`,
  );

  // canonical
  html = html.replace(
    /<link\s+rel="canonical"[^>]*>/,
    `<link rel="canonical" href="${escapeAttr(meta.canonical)}" />`,
  );

  // hreflang alternates — remove all existing hreflang links, then inject
  if (meta.alternates && meta.alternates.length > 0) {
    html = html.replace(/\s*<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*>/g, '');
    const altBlock = meta.alternates
      .map((a) => `    <link rel="alternate" hreflang="${escapeAttr(a.lang)}" href="${escapeAttr(a.href)}" />`)
      .join('\n');
    html = html.replace(/<link\s+rel="canonical"[^>]*>/, (m) => `${m}\n${altBlock}`);
  }

  // OG
  html = replaceMetaProperty(html, 'og:title', meta.title);
  html = replaceMetaProperty(html, 'og:description', meta.description);
  html = replaceMetaProperty(html, 'og:url', meta.canonical);
  html = replaceMetaProperty(html, 'og:type', ogType);
  html = replaceMetaProperty(html, 'og:image', image);
  html = replaceMetaProperty(html, 'og:image:secure_url', image);

  // Twitter
  html = replaceMetaName(html, 'twitter:title', meta.title);
  html = replaceMetaName(html, 'twitter:description', meta.description);
  html = replaceMetaName(html, 'twitter:image', image);

  // Extra JSON-LD — appended inside <head>, in addition to the site @graph
  if (jsonLdArray.length > 0) {
    const scripts = jsonLdArray
      .map((obj) => `    <script type="application/ld+json">${JSON.stringify(obj)}</script>`)
      .join('\n');
    html = html.replace('</head>', `${scripts}\n  </head>`);
  }

  // React 19's renderToString hoists <title>, <meta>, <link> from page
  // components to the body stream. Strip those duplicates — the authoritative
  // copies are already in <head> from the rewrites above.
  const cleanedBody = stripHeadTagsFromBody(bodyHtml);

  // Inject rendered HTML into <div id="root">
  html = html.replace('<div id="root"></div>', `<div id="root">${cleanedBody}</div>`);

  return html;
}

function stripHeadTagsFromBody(body: string): string {
  return body
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<meta\s+name="description"[^>]*\/?>/g, '')
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*\/?>/g, '')
    .replace(/<meta\s+property="og:[^"]*"[^>]*\/?>/g, '')
    .replace(/<link\s+rel="canonical"[^>]*\/?>/g, '')
    .replace(/<link\s+rel="alternate"\s+hrefLang="[^"]*"[^>]*\/?>/g, '')
    .replace(/<link\s+rel="alternate"\s+hreflang="[^"]*"[^>]*\/?>/g, '')
    .replace(/<script\s+type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/g, '');
}

function replaceMetaProperty(html: string, prop: string, value: string): string {
  const re = new RegExp(`<meta\\s+property="${escapeRegex(prop)}"[^>]*>`);
  const replacement = `<meta property="${prop}" content="${escapeAttr(value)}" />`;
  return re.test(html) ? html.replace(re, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function replaceMetaName(html: string, name: string, value: string): string {
  const re = new RegExp(`<meta\\s+name="${escapeRegex(name)}"[^>]*>`);
  const replacement = `<meta name="${name}" content="${escapeAttr(value)}" />`;
  return re.test(html) ? html.replace(re, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function escape(s: string): string {
  return s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function main() {
  console.log('[prerender] Building SSR bundle...');
  await ssrBuild();

  const entryUrl = pathToFileURL(path.join(ssrDir, 'entry-server.mjs')).href;
  const { render, routes } = (await import(entryUrl)) as typeof import('../src/entry-server.js');

  const template = await fs.readFile(path.join(distDir, 'index.html'), 'utf8');

  for (const route of routes) {
    console.log(`[prerender] ${route.path} -> dist/${route.output}`);
    const { html: body } = render(route.path, 'ru');
    const finalHtml = applyMeta(template, route.meta, body);
    const outPath = path.join(distDir, route.output);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, finalHtml, 'utf8');
  }

  // Remove the SSR bundle — it is a build artefact, not a runtime asset.
  await fs.rm(ssrDir, { recursive: true, force: true });
  console.log('[prerender] Done.');
}

main().catch((err) => {
  console.error('[prerender] Failed:', err);
  process.exit(1);
});
