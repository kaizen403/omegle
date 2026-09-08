"use client";

import { StatCard as ConsoleStatCard, type Tone } from "@/components/console";

type AccentColor = "blue" | "zinc" | "yellow" | "green" | "purple" | "pink";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  /**
   * Legacy accent name. Kept so existing call sites keep compiling; it now
   * resolves to one of the console's five semantic tones rather than a raw
   * Tailwind colour.
   */
  accentColor?: AccentColor;
  /**
   * Kept for compatibility only. The staggered entrance animations were
   * removed — they made the whole dashboard reshuffle on every navigation.
   */
  delay?: number;
  /** Explicit tone; wins over `accentColor` when both are given. */
  tone?: Tone;
  className?: string;
}

const accentTone: Record<AccentColor, Tone> = {
  blue: "info",
  zinc: "neutral",
  yellow: "warning",
  green: "success",
  purple: "info",
  pink: "neutral",
};

/**
 * The dashboard's stat card is now a thin wrapper over the console primitive,
 * so every headline number on the site shares one set of type sizes, one
 * border, and `tabular-nums` values that do not resize as counters tick.
 */
export function StatCard({
  title,
  value,
  subtitle,
  accentColor = "blue",
  tone,
  className,
}: StatCardProps) {
  return (
    <ConsoleStatCard
      label={title}
      value={value}
      hint={subtitle}
      tone={tone ?? accentTone[accentColor]}
      className={className}
    />
  );
}
