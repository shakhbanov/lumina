/**
 * Per-route metadata as React elements. React 19 hoists <title>, <meta>,
 * and <link> out of any subtree into <head> automatically, so we can
 * render this anywhere inside a page component.
 *
 * For prerendering, each page also exports a `meta` constant (with the
 * same values) that the build script reads to rewrite the static HTML's
 * <head> — that way AI crawlers which don't execute JavaScript still see
 * per-route titles and descriptions in the initial HTML payload.
 */

export interface PageMeta {
  /** Full <title> content. Keep ≤60 chars for Russian SERPs. */
  title: string;
  /** Meta description. Keep 150–160 chars. */
  description: string;
  /** Canonical absolute URL. */
  canonical: string;
  /** OG image absolute URL. Defaults to the site OG image. */
  ogImage?: string;
  /** OG type. Defaults to "website". */
  ogType?: 'website' | 'article';
  /** Optional <link rel="alternate" hreflang> overrides keyed by language. */
  alternates?: { lang: string; href: string }[];
  /** Extra JSON-LD objects to inject alongside the site graph. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const DEFAULT_OG_IMAGE = 'https://lumina.su/og-image.png';

export function Meta({ title, description, canonical, ogImage, ogType = 'website', alternates, jsonLd }: PageMeta) {
  const image = ogImage ?? DEFAULT_OG_IMAGE;
  const jsonLdArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {alternates?.map((alt) => (
        <link key={alt.lang} rel="alternate" hrefLang={alt.lang} href={alt.href} />
      ))}

      {jsonLdArray.map((obj, i) => (
        <script
          key={i}
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}
        />
      ))}
    </>
  );
}
