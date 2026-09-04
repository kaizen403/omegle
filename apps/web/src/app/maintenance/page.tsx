'use client';

import Link from 'next/link';
import { LogoMark } from '@/components/brand';
import { SiteNav, SiteFooter } from '@/components/site';
import { useMaintenanceStatus } from '@/hooks';

const LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/community-guidelines', label: 'Guidelines' },
];

/**
 * Maintenance Page Component
 *
 * @description Shown while the site is paused. Whether it is paused is decided at runtime by
 * MaintenanceGuard, which polls the backend's /status endpoint; the guard also sends people
 * back to /welcome once the switch is flipped off, so this page does not redirect itself.
 * The operator's note from the admin dashboard is rendered when there is one.
 * Page title is set in layout.tsx using Next.js metadata API.
 */
export default function MaintenancePage() {
  const { message } = useMaintenanceStatus();

  return (
    <div className="bg-sky bg-bubbles text-text flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="bg-surface shadow-card pop w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
          <LogoMark size={56} className="mx-auto" />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Back soon</h1>
          <p className="text-text-2 mt-3">
            We&apos;re doing a bit of maintenance. Chat will reopen shortly.
          </p>

          {/* The note arrives with the first poll, so announce it politely when it lands. */}
          {message && (
            <p
              aria-live="polite"
              className="bg-blue-softer text-blue-dark mt-6 rounded-2xl px-4 py-3 text-sm leading-relaxed"
            >
              {message}
            </p>
          )}

          <div className="bg-sky mt-7 space-y-2 rounded-2xl p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-text-3">Status</span>
              <span className="text-text inline-flex items-center gap-2 font-medium">
                <span className="bg-orange size-2 rounded-full" aria-hidden />
                Paused
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-3">Hours</span>
              <span className="text-text font-medium">9 PM to 2 AM IST</span>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-text-3 hover:text-text transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
