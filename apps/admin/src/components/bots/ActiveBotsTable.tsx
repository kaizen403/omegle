"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  Section,
  StatusPill,
  TableShell,
  TableSkeleton,
  Td,
  Th,
  Tr,
} from "@/components/console";
import { BotInfo } from "./types";

interface ActiveBotsTableProps {
  bots: BotInfo[];
  loading: boolean;
  onRefresh: () => void;
}

export function ActiveBotsTable({
  bots,
  loading,
  onRefresh,
}: ActiveBotsTableProps) {
  return (
    <Section
      title="Active bots"
      description="Bot instances that are currently spawned."
      contentClassName="p-0"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw
            className={`size-4 ${loading ? "animate-spin" : ""}`}
            strokeWidth={2}
          />
          Refresh
        </Button>
      }
    >
      {!loading && bots.length === 0 ? (
        <EmptyState
          title="No bots are running"
          description="Enable the bot system to spawn bots. They will show up here once they join."
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th className="hidden md:table-cell" align="right" width="4.5rem">
                Age
              </Th>
              <Th className="hidden md:table-cell">Branch</Th>
              <Th className="hidden lg:table-cell" width="6rem">
                Year
              </Th>
              <Th width="8rem">Status</Th>
              <Th align="right" width="7rem">
                Messages
              </Th>
            </tr>
          </thead>
          {loading ? (
            <TableSkeleton rows={4} cols={6} />
          ) : (
            <tbody>
              {bots.map((bot) => (
                <Tr key={bot.uid}>
                  <Td className="max-w-[16rem]">
                    <span
                      className="block truncate font-medium"
                      title={bot.name}
                    >
                      {bot.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground md:hidden">
                      {bot.branch} · {bot.year} · {bot.age}
                    </span>
                  </Td>
                  <Td
                    className="hidden tabular-nums md:table-cell"
                    align="right"
                  >
                    {bot.age}
                  </Td>
                  <Td className="hidden max-w-[12rem] md:table-cell">
                    <span className="block truncate" title={bot.branch}>
                      {bot.branch}
                    </span>
                  </Td>
                  <Td className="hidden lg:table-cell">{bot.year}</Td>
                  <Td>
                    <StatusPill
                      tone={bot.isMatched ? "success" : "neutral"}
                      dot
                    >
                      {bot.isMatched ? "In chat" : "Available"}
                    </StatusPill>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    {bot.messageCount}
                  </Td>
                </Tr>
              ))}
            </tbody>
          )}
        </TableShell>
      )}
    </Section>
  );
}
