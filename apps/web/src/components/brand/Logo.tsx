import Image from 'next/image';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  /** Rendered height of the wordmark in pixels */
  height?: number;
  className?: string;
  href?: string | null;
  priority?: boolean;
}

/** Omegle wordmark (blue speech bubble + orange lettering). */
export function Logo({ height = 28, className, href = '/welcome', priority }: LogoProps) {
  const width = Math.round(height * (2560 / 620));
  const img = (
    <Image
      src="/omegle.png"
      alt="Omegle"
      width={width}
      height={height}
      priority={priority}
      className={cn('block h-auto select-none', className)}
      style={{ width, height }}
    />
  );
  if (!href) return img;
  return (
    <Link href={href} aria-label="Omegle home" className="inline-flex shrink-0 items-center">
      {img}
    </Link>
  );
}

/** Square speech-bubble mark only. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/omegle-mark.png"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn('block select-none', className)}
      style={{ width: size, height: size }}
    />
  );
}

/** Full lockup: "Talk to strangers!", wordmark, "for VITAP Students". */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <p className="text-text text-xl font-bold tracking-tight sm:text-2xl">
        Talk to strangers!{' '}
        <span className="inline-block animate-wave" aria-hidden>
          👋
        </span>
      </p>
      <Logo height={56} href={null} priority className="sm:h-16" />
      <p className="text-text-2 inline-flex items-center gap-1.5 text-[15px] font-semibold">
        <GraduationCap className="size-[18px]" strokeWidth={2.25} aria-hidden />
        for VITAP Students
      </p>
    </div>
  );
}
