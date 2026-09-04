'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { WelcomeForm } from '@/components/welcome/WelcomeForm';
import { Logo, BrandLockup } from '@/components/brand';

export default function WelcomePage() {
  useEffect(() => {
    document.title = 'Omegle for VITAP students';
  }, []);

  return (
    <div className="bg-sky bg-bubbles text-text flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo height={26} priority />
        <nav className="flex items-center gap-1" aria-label="Site">
          <Link
            href="/faq"
            className="text-text-2 hover:text-text hover:bg-surface rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
          >
            FAQ
          </Link>
          <Link
            href="/community-guidelines"
            className="text-text-2 hover:text-text hover:bg-surface rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
          >
            Guidelines
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="pop pop-1">
            <BrandLockup />
            <p className="text-text-2 mx-auto mt-4 max-w-xs text-center text-[15px] leading-relaxed">
              Random video and text chat with people on campus. No sign up, no history.
            </p>
          </div>

          <div className="pop pop-2 mt-7">
            <WelcomeForm />
          </div>
        </div>
      </main>

      <footer className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <p className="text-text-3 text-sm">© {new Date().getFullYear()} Omegle VITAP</p>
        <nav className="flex gap-5 text-sm" aria-label="Legal">
          <Link href="/terms" className="text-text-3 hover:text-text transition-colors">
            Terms
          </Link>
          <Link href="/privacy" className="text-text-3 hover:text-text transition-colors">
            Privacy
          </Link>
          <Link
            href="/community-guidelines"
            className="text-text-3 hover:text-text transition-colors"
          >
            Guidelines
          </Link>
        </nav>
      </footer>
    </div>
  );
}
