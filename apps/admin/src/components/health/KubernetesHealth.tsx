"use client";

import { Section, StatusPill, EmptyState } from "@/components/console";
import type { SystemHealth } from "@/types/socket";
import { cn } from "@/lib/utils";

interface KubernetesHealthProps {
  systemHealth: SystemHealth | null;
}

/** Same anti-collision rule as CloudRunInfo: the value truncates, not the label. */
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

export function KubernetesHealth({ systemHealth }: KubernetesHealthProps) {
  const k8s = systemHealth?.kubernetes;

  return (
    <Section
      title="Kubernetes deployment"
      actions={
        k8s ? (
          <StatusPill tone={k8s.isKubernetes ? "success" : "neutral"} dot>
            {k8s.isKubernetes ? "Kubernetes" : "Local"}
          </StatusPill>
        ) : undefined
      }
    >
      {k8s ? (
        <dl className="min-w-0">
          <DetailRow label="Pod name" value={k8s.podName} mono />
          <DetailRow label="Namespace" value={k8s.namespace} mono />
          <DetailRow label="Cluster" value={k8s.cluster} mono />
          <DetailRow label="Node" value={k8s.nodeName} mono />
          <DetailRow label="Pod IP" value={k8s.podIP} mono />
        </dl>
      ) : (
        <EmptyState
          title="Waiting for Kubernetes info"
          description="The next health poll will fill this in."
        />
      )}
    </Section>
  );
}
