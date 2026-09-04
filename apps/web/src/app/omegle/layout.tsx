import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Chat',
  description: 'Live campus video and text chat. This room is private and is not listed in search.',
  path: '/omegle',
  index: false,
  follow: false,
});

export default function OmegleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
