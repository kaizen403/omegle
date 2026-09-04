'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogoMark } from '@/components/brand';
import { SiteNav, SiteFooter } from '@/components/site';

export default function NotFound() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown === 0) {
      router.push('/welcome');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router]);

  return (
    <div className="bg-sky bg-bubbles text-text flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="bg-surface shadow-card pop w-full max-w-md rounded-3xl p-8 text-center sm:p-10">
          <LogoMark size={56} className="mx-auto" />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Nothing here</h1>
          <p className="text-text-2 mt-3">
            That page doesn&apos;t exist. Taking you home in{' '}
            <span className="text-text font-semibold tabular-nums">{countdown}</span>s.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/welcome"
              className="bg-blue hover:bg-blue-dark inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-colors"
            >
              Go home
            </Link>
            <Link
              href="/faq"
              className="bg-blue-softer hover:bg-blue-soft text-blue-dark inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors"
            >
              FAQ
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
