"use client";

import { StatusPill } from "@/components/console";

interface ExportSuccessIndicatorProps {
  show: boolean;
}

export function ExportSuccessIndicator({ show }: ExportSuccessIndicatorProps) {
  if (!show) return null;

  return <StatusPill tone="success">Exported</StatusPill>;
}
