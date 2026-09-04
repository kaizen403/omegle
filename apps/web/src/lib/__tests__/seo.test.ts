import { afterEach, describe, expect, it, vi } from 'vitest';

describe('seo helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('normalizes paths for trailingSlash and builds absolute URLs', async () => {
    const { pagePath, absoluteUrl, SITE_URL } = await import('../seo');

    expect(pagePath('/')).toBe('/');
    expect(pagePath('faq')).toBe('/faq/');
    expect(pagePath('/faq')).toBe('/faq/');
    expect(pagePath('/faq/')).toBe('/faq/');

    expect(absoluteUrl('/')).toBe(`${SITE_URL}/`);
    expect(absoluteUrl('/privacy')).toBe(`${SITE_URL}/privacy/`);
  });

  it('builds page metadata with a relative canonical', async () => {
    const { pageMetadata } = await import('../seo');
    const metadata = pageMetadata({
      title: 'FAQ',
      description: 'Answers about campus chat.',
      path: '/faq',
    });

    expect(metadata.title).toBe('FAQ');
    expect(metadata.alternates).toEqual({ canonical: '/faq/' });
    expect(metadata.openGraph).toMatchObject({ url: '/faq/' });
    expect(metadata.robots).toBeUndefined();
  });

  it('marks private routes as noindex', async () => {
    const { pageMetadata } = await import('../seo');
    const metadata = pageMetadata({
      title: 'Chat',
      description: 'Live chat room.',
      path: '/omegle',
      index: false,
      follow: false,
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('falls back to vitap.in when NEXT_PUBLIC_APP_URL is invalid', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'not a url');
    const { SITE_URL, absoluteUrl } = await import('../seo');

    expect(SITE_URL).toBe('https://vitap.in');
    expect(absoluteUrl('/faq')).toBe('https://vitap.in/faq/');
  });
});
