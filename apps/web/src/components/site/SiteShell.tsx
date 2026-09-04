import Link from 'next/link';
import { Logo } from '@/components/brand';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/faq', label: 'FAQ' },
  { href: '/community-guidelines', label: 'Guidelines' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
];

export function SiteNav() {
  return (
    <header className="bg-sky/85 sticky top-0 z-40 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <Logo height={26} priority />
        <nav className="flex items-center gap-1" aria-label="Site">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-text-2 hover:text-text hover:bg-surface hidden rounded-full px-3.5 py-2 text-sm font-medium transition-colors sm:inline-flex"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/welcome"
            className="bg-blue hover:bg-blue-dark ml-2 inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold text-white transition-colors"
          >
            Start chatting
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
      <Logo height={20} />
      <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm" aria-label="Legal">
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-text-3 hover:text-text transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <p className="text-text-3 text-sm">© {new Date().getFullYear()} Omegle VITAP</p>
    </footer>
  );
}

interface PageShellProps {
  children: React.ReactNode;
  width?: 'narrow' | 'wide';
}

/** Sky background, nav, a white rounded content card, footer. */
export function PageShell({ children, width = 'narrow' }: PageShellProps) {
  return (
    <div className="bg-sky bg-bubbles text-text min-h-screen">
      <SiteNav />
      <main
        className={cn('mx-auto px-4 pt-4 sm:px-5', width === 'narrow' ? 'max-w-3xl' : 'max-w-5xl')}
      >
        <div className="bg-surface shadow-card pop rounded-3xl px-6 py-10 sm:px-12 sm:py-14">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  lede?: string;
  meta?: string;
  align?: 'left' | 'center';
}

export function PageHeader({ title, lede, meta, align = 'left' }: PageHeaderProps) {
  return (
    <header className={cn('mb-10', align === 'center' && 'mx-auto max-w-xl text-center')}>
      <h1 className="text-text text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
      {lede && <p className="text-text-2 mt-4 text-lg leading-relaxed">{lede}</p>}
      {meta && <p className="text-text-3 mt-4 text-sm">{meta}</p>}
    </header>
  );
}

/** Plain document section. */
export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="text-text text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-text-2 mt-3 space-y-3 text-[15px] leading-relaxed [&_strong]:font-semibold [&_strong]:text-text [&_ul]:space-y-2 [&_ul]:pl-5 [&_li]:list-disc [&_li]:marker:text-blue">
        {children}
      </div>
    </section>
  );
}
