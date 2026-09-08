import { StatCard, StatusDot, type Tone } from "@/components/console";

interface MetricCardProps {
  title: string;
  value: string | number;
  status?: "healthy" | "warning" | "error";
  subtitle?: string;
}

const STATUS_TONE: Record<NonNullable<MetricCardProps["status"]>, Tone> = {
  healthy: "success",
  warning: "warning",
  error: "danger",
};

/** Thin wrapper over the console `StatCard`, kept for existing call sites. */
export default function MetricCard({
  title,
  value,
  status,
  subtitle,
}: MetricCardProps) {
  return (
    <StatCard
      label={title}
      value={value}
      hint={subtitle}
      tone={status ? STATUS_TONE[status] : "neutral"}
      action={status ? <StatusDot tone={STATUS_TONE[status]} /> : undefined}
    />
  );
}
