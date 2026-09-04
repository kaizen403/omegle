import type { Metadata } from 'next';

const FALLBACK_SITE_URL = 'https://vitap.in';

export const SITE_NAME = 'Omegle VITAP';
export const SITE_SHORT_NAME = 'Omegle';

export const SITE_DESCRIPTION =
  'Anonymous video and text chat with people on campus. No sign up, no chat history. Built for VIT-AP, SRM-AP, and NID-AP students.';

export const SITE_TITLE = `${SITE_NAME} — Random video chat for campus`;

function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? FALLBACK_SITE_URL;
  try {
    return new URL(raw).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export const SITE_URL = resolveSiteUrl();

/** Path with a trailing slash, except for the site root. Matches `trailingSlash: true`. */
export function pagePath(path: string): string {
  if (path === '/') return '/';
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

export function absoluteUrl(path: string): string {
  const pathname = pagePath(path);
  return pathname === '/' ? `${SITE_URL}/` : `${SITE_URL}${pathname}`;
}

export function pageMetadata({
  title,
  description,
  path,
  index = true,
  follow = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  follow?: boolean;
}): Metadata {
  const canonical = pagePath(path);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
    },
    ...(index && follow
      ? {}
      : {
          robots: {
            index,
            follow,
          },
        }),
  };
}

export function webPageJsonLd(name: string, description: string, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name,
    description,
    url: absoluteUrl(path),
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: `${SITE_URL}/`,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name, item: absoluteUrl(path) },
      ],
    },
  };
}

export function faqPageJsonLd(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export function siteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        alternateName: SITE_SHORT_NAME,
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        inLanguage: 'en-IN',
      },
      {
        '@type': 'WebApplication',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        applicationCategory: 'SocialNetworkingApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'INR',
        },
        featureList: ['Random video chat', 'Text chat', 'Anonymous, no sign up', 'No chat history'],
      },
    ],
  };
}
