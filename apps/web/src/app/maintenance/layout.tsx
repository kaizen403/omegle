import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Under maintenance',
  description: 'Omegle VITAP is paused for maintenance. Chat will reopen shortly.',
  path: '/maintenance',
  index: false,
  follow: false,
});

export default function MaintenanceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
