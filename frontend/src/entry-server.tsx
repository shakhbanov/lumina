import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from './App';
import { setLocale, type Locale } from './lib/i18n';

import { meta as landingMeta } from './pages/LandingPage';
import { meta as aboutMeta } from './pages/AboutPage';
import { meta as faqMeta } from './pages/FaqPage';
import { meta as installMeta } from './pages/InstallPage';
import { meta as privacyMeta } from './pages/PrivacyPage';
import { meta as termsMeta } from './pages/TermsPage';
import type { PageMeta } from './components/seo/Meta';

export interface PrerenderRoute {
  /** Router pathname to render (no query string, no trailing slash). */
  path: string;
  /** Filesystem output path relative to dist/, e.g. "about/index.html". */
  output: string;
  /** Per-page metadata used to rewrite <head> tags in the static HTML. */
  meta: PageMeta;
}

export const routes: PrerenderRoute[] = [
  { path: '/', output: 'index.html', meta: landingMeta },
  { path: '/about', output: 'about/index.html', meta: aboutMeta },
  { path: '/faq', output: 'faq/index.html', meta: faqMeta },
  { path: '/install', output: 'install/index.html', meta: installMeta },
  { path: '/privacy', output: 'privacy/index.html', meta: privacyMeta },
  { path: '/terms', output: 'terms/index.html', meta: termsMeta },
];

export interface RenderResult {
  html: string;
}

export function render(url: string, locale: Locale = 'ru'): RenderResult {
  setLocale(locale);
  const html = renderToString(
    <StaticRouter location={url}>
      <App />
    </StaticRouter>,
  );
  return { html };
}
