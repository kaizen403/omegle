"use client";

import { Section } from "@/components/console";
import { cn } from "@/lib/utils";

interface CloudRunData {
  service?: string;
  serviceName?: string;
  revision?: string;
  region?: string;
  configuration?: string;
  port?: string | number;
  url?: string;
}

interface CloudRunInfoProps {
  cloudRun: CloudRunData;
  nodeVersion?: string;
}

/**
 * A label/value detail row.
 *
 * The label is fixed width and the value is the growing child, so a long
 * revision name truncates inside its own cell instead of shoving the label
 * off the card. The full value is always available on hover.
 */
function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-b-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right font-medium text-foreground",
          mono && "font-mono text-[0.8125rem] tabular-nums",
        )}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

export function CloudRunInfo({ cloudRun, nodeVersion }: CloudRunInfoProps) {
  const rows: Array<{ label: string; value: string; mono?: boolean }> = [
    {
      label: "Service",
      value: cloudRun.service || cloudRun.serviceName || "N/A",
      mono: true,
    },
    { label: "Revision", value: cloudRun.revision || "N/A", mono: true },
    { label: "Region", value: cloudRun.region || "N/A", mono: true },
    {
      label: "Configuration",
      value: cloudRun.configuration || "N/A",
      mono: true,
    },
    { label: "Port", value: String(cloudRun.port ?? "N/A"), mono: true },
    { label: "Node version", value: nodeVersion || "N/A", mono: true },
  ];

  return (
    <Section title="Cloud Run deployment">
      <dl className="min-w-0">
        {rows.map((row) => (
          <DetailRow
            key={row.label}
            label={row.label}
            value={row.value}
            mono={row.mono}
          />
        ))}
      </dl>
    </Section>
  );
}
