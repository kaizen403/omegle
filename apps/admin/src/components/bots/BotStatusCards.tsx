"use client";

import { Bot, Users, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BotStatus } from "./types";

interface BotStatusCardsProps {
  status: BotStatus | null;
  loading: boolean;
}

export function BotStatusCards({ status, loading }: BotStatusCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Status Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-zinc-400">Status</p>
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-16 sm:w-20 mt-1" />
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  {status?.enabled ? (
                    <Badge className="bg-emerald-600 text-xs">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div
              className={`p-2 sm:p-3 rounded-full flex-shrink-0 ${status?.enabled ? "bg-emerald-900/50" : "bg-zinc-800"}`}
            >
              <Bot
                className={`h-5 w-5 sm:h-6 sm:w-6 ${status?.enabled ? "text-emerald-400" : "text-zinc-500"}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Bots Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-zinc-400">Total Bots</p>
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12 mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {status?.totalBots || 0}
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-blue-900/50 flex-shrink-0">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matched Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-zinc-400">Matched</p>
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12 mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {status?.matchedBots || 0}
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-purple-900/50 flex-shrink-0">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Card */}
      <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-zinc-400">Available</p>
              {loading ? (
                <Skeleton className="h-6 sm:h-8 w-10 sm:w-12 mt-1" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">
                  {status?.availableBots || 0}
                </p>
              )}
            </div>
            <div className="p-2 sm:p-3 rounded-full bg-amber-900/50 flex-shrink-0">
              <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-amber-400" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
