"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tone, toneChip, toneFill } from "./tone";

/**
 * A status chip. Sentence case, one hairline border, no uppercase tracking.
 */
export function StatusPill({
  children,
  tone = "neutral",
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneChip[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", toneFill[tone])} />}
      {children}
    </span>
  );
}

/**
 * A bare status dot.
 *
 * Note there is no `animate-ping` halo here on purpose: the old console had
 * pinging dots in table rows, which draws the eye to nothing and makes a busy
 * list feel like it is vibrating. A quiet pulse is offered but off by default.
 */
export function StatusDot({
  tone = "neutral",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        toneFill[tone],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}

/** An identifier rendered as a compact mono chip. Truncates, never wraps. */
export function IdChip({
  value,
  prefix = "#",
  className,
  title,
}: {
  value: string | number;
  prefix?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span
      className={cn("id-chip max-w-full truncate", className)}
      title={title ?? String(value)}
    >
      {prefix}
      {value}
    </span>
  );
}

/**
 * Circular initial avatar. Colour is derived from the seed so the same user
 * keeps the same colour between renders, but the palette stays inside the
 * console's chart colours instead of random neon gradients.
 */
const AVATAR_TONES = [
  "bg-[#e0f2fe] text-[#026aa2]",
  "bg-[#e8f5e9] text-[#067647]",
  "bg-[#fef0c7] text-[#b54708]",
  "bg-[#ece9fe] text-[#5925dc]",
  "bg-[#fce7f3] text-[#c11574]",
  "bg-[#e4e9f0] text-[#344054]",
];

export function Avatar({
  name,
  seed,
  size = "md",
  className,
}: {
  name: string;
  seed?: string | number;
  size?: "sm" | "md";
  className?: string;
}) {
  const key = String(seed ?? name);
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const tone = AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
        tone,
        className,
      )}
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
