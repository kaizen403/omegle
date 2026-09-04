import type { Metadata } from 'next';

/** Same page as `/` — point crawlers at the homepage so we do not split ranking. */
export const metadata: Metadata = {
  alternates: {
    canonical: '/',
  },
  openGraph: {
    url: '/',
  },
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
