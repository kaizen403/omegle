"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Bot, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  // Track if we've already animated (to prevent re-animation on data updates)
  const hasAnimated = useRef(false);

  // Only animate on first render - use effect to update ref
  useEffect(() => {
    if (bots.length > 0 && !loading) {
      hasAnimated.current = true;
    }
  }, [bots.length, loading]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Active Bots
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Currently spawned bot instances
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              className="border-zinc-700 self-end sm:self-auto"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <div className="text-center py-8 text-zinc-400">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No bots are currently active</p>
              <p className="text-sm mt-1">Enable bots to spawn them</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[600px] sm:min-w-0 px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-zinc-800">
                      <TableHead className="text-xs sm:text-sm">Name</TableHead>
                      <TableHead className="text-xs sm:text-sm">Age</TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        Branch
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">Year</TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        Status
                      </TableHead>
                      <TableHead className="text-xs sm:text-sm">
                        Messages
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bots.map((bot) => (
                      <TableRow
                        key={bot.uid}
                        className="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                      >
                        <TableCell className="font-medium text-xs sm:text-sm">
                          {bot.name}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {bot.age}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {bot.branch}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {bot.year}
                        </TableCell>
                        <TableCell>
                          {bot.isMatched ? (
                            <Badge className="bg-emerald-600 text-xs">
                              In Chat
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Available
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">
                          {bot.messageCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
