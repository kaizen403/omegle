"use client";

import { Power, PowerOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Section, StatusPill } from "@/components/console";
import { BotStatus } from "./types";

interface BotControlsProps {
  status: BotStatus | null;
  loading: boolean;
  toggling: boolean;
  localMaxBots: number;
  onToggle: () => void;
  onMaxBotsChange: (value: number) => void;
}

export function BotControls({
  status,
  loading,
  toggling,
  localMaxBots,
  onToggle,
  onMaxBotsChange,
}: BotControlsProps) {
  const enabled = status?.enabled ?? false;

  return (
    <Section
      title="Bot controls"
      description="Turn the bot system on or off and cap how many bots run at once."
      actions={
        <StatusPill tone={enabled ? "success" : "neutral"} dot>
          {enabled ? "Running" : "Stopped"}
        </StatusPill>
      }
    >
      <div className="max-w-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-lg border border-border bg-muted/50 px-3 py-3">
          <div className="min-w-0 flex-1">
            <Label htmlFor="bot-toggle" className="text-sm font-medium">
              Bot system
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {enabled
                ? "Bots are active and matching with users."
                : "Bots are disabled and will not match."}
            </p>
          </div>
          <Button
            id="bot-toggle"
            variant={enabled ? "destructive" : "default"}
            size="sm"
            onClick={onToggle}
            disabled={toggling || loading}
            className="shrink-0"
          >
            {toggling ? (
              <RefreshCw className="size-4 animate-spin" strokeWidth={2} />
            ) : enabled ? (
              <PowerOff className="size-4" strokeWidth={2} />
            ) : (
              <Power className="size-4" strokeWidth={2} />
            )}
            {enabled ? "Disable" : "Enable"}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="max-bots" className="text-sm font-medium">
              Max bots
            </Label>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
              {localMaxBots}
            </span>
          </div>
          <Slider
            id="max-bots"
            value={[localMaxBots]}
            onValueChange={(value: number[]) => onMaxBotsChange(value[0])}
            max={50}
            min={1}
            step={1}
            className="w-full"
          />
          <p className="text-sm text-muted-foreground">
            The most bots that can be active at the same time. Between 1 and 50.
          </p>
        </div>
      </div>
    </Section>
  );
}
