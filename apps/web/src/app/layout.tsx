import {
  UserProvider,
  MediaStateProvider,
  AnalyticsProvider,
  MaintenanceGuard,
  ToastProvider,
} from '@/providers';
import { BrowserPolyfillInit, GlobalErrorHandler } from '@/components/common';
import { JsonLd } from '@/components/seo/JsonLd';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, siteJsonLd } from '@/lib/seo';
import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import { HeroUIProvider } from '@heroui/system';
import './globals.css';

const figtree = Figtree({
  variable: '--font-figtree',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#3b9dff',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  category: 'social networking',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  openGraph: {
    url: '/',
    siteName: SITE_NAME,
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: [{ url: '/omegle-mark.png', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
    shortcut: '/omegle-mark.png',
  },
  manifest: '/site.webmanifest',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body className={`${figtree.variable} antialiased`}>
        <JsonLd data={siteJsonLd()} />
        <BrowserPolyfillInit />
        <GlobalErrorHandler />
        <HeroUIProvider>
          <ToastProvider>
            <MaintenanceGuard>
              <AnalyticsProvider>
                <UserProvider>
                  <MediaStateProvider>{children}</MediaStateProvider>
                </UserProvider>
              </AnalyticsProvider>
            </MaintenanceGuard>
          </ToastProvider>
        </HeroUIProvider>
      </body>
    </html>
  );
}
