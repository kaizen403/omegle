"use client";

import {
  ChevronDown,
  Clipboard,
  Download,
  FileJson,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Room } from "@/types/socket";
import { EmptyState, IdChip, StatusPill } from "@/components/console";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportAsJSON,
  exportAsTXT,
  copyToClipboard,
} from "@/lib/services/chatExportService";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";

interface MonitorModalProps {
  monitoringRoomId: string;
  rooms: Room[];
  monitoredRooms: Map<
    string,
    Array<{ message?: { sender: string; content: string }; timestamp: number }>
  >;
  onClose: () => void;
  onCloseRoom: (roomId: string) => void;
}

export function MonitorModal({
  monitoringRoomId,
  rooms,
  monitoredRooms,
  onClose,
  onCloseRoom,
}: MonitorModalProps) {
  const messages = useMemo(
    () => monitoredRooms.get(monitoringRoomId) || [],
    [monitoredRooms, monitoringRoomId],
  );
  const currentRoom = useMemo(
    () => rooms.find((r) => r.roomId === monitoringRoomId),
    [rooms, monitoringRoomId],
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const isRoomActive = !!currentRoom && currentRoom.status !== "closed";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const showExportSuccess = useCallback(() => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2000);
  }, []);

  const exportOptions = useMemo(
    () => ({
      roomId: monitoringRoomId,
      messages,
      room: currentRoom,
    }),
    [monitoringRoomId, messages, currentRoom],
  );

  const handleExportJSON = useCallback(() => {
    exportAsJSON(exportOptions);
    showExportSuccess();
  }, [exportOptions, showExportSuccess]);

  const handleExportTXT = useCallback(() => {
    exportAsTXT(exportOptions);
    showExportSuccess();
  }, [exportOptions, showExportSuccess]);

  const handleCopyToClipboard = useCallback(async () => {
    await copyToClipboard(exportOptions);
    showExportSuccess();
  }, [exportOptions, showExportSuccess]);

  const exportMenu = messages.length > 0 && (
    <DropdownMenu open={showExportMenu} onOpenChange={setShowExportMenu}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="size-4" strokeWidth={2} />
          <span className="hidden sm:inline">Export</span>
          <ChevronDown
            className={`size-3.5 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => handleExportJSON()}>
          <FileJson className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Export as JSON</span>
            <span className="block text-xs text-muted-foreground">
              Structured data
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => handleExportTXT()}>
          <FileText className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Export as text</span>
            <span className="block text-xs text-muted-foreground">
              Plain transcript
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => handleCopyToClipboard()}>
          <Clipboard className="size-4" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block font-medium">Copy to clipboard</span>
            <span className="block text-xs text-muted-foreground">
              Quick copy
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixed; only the transcript below it moves */}
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">
              Room monitor
            </h2>
            <StatusPill tone={isRoomActive ? "success" : "neutral"} dot>
              {isRoomActive ? "Live" : "Ended"}
            </StatusPill>
            <IdChip
              value={`${monitoringRoomId.slice(0, 8)}…${monitoringRoomId.slice(-4)}`}
              title={monitoringRoomId}
            />
            {!isRoomActive && messages.length > 0 && (
              <span className="text-xs text-muted-foreground">
                History preserved
              </span>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {exportMenu}
            {exportSuccess && <StatusPill tone="success">Exported</StatusPill>}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="size-4" strokeWidth={2} />
              Close
            </Button>
          </div>
        </div>

        {/* Transcript */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {messages.length === 0 ? (
            <EmptyState
              title="Waiting for messages"
              description="Messages appear here in real time."
            />
          ) : (
            <div className="space-y-3">
              {messages.map((msg, idx) => {
                const sender = msg.message?.sender || "Unknown";

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-border bg-muted/40 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          User {sender.slice(-4)}
                        </span>
                        <IdChip value={sender} />
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                      {msg.message?.content || (
                        <span className="text-muted-foreground">
                          No content
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border px-4 py-3 sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums text-foreground">
              {messages.length}
            </span>
            <span>{messages.length === 1 ? "message" : "messages"}</span>
          </div>

          {isRoomActive && (
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:bg-danger-surface hover:text-danger"
              onClick={() => {
                if (currentRoom) {
                  onCloseRoom(currentRoom.roomId);
                }
              }}
            >
              <X className="size-4" strokeWidth={2} />
              End room
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default MonitorModal;
