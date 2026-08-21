"use client";

import { Button } from "@/components/ui/button";

interface MonitorHeaderProps {
  roomId: string;
  isRoomActive: boolean;
  onBack: () => void;
  children?: React.ReactNode;
}

export function MonitorHeader({
  roomId,
  isRoomActive,
  onBack,
  children,
}: MonitorHeaderProps) {
  return (
    <div className="border-b border-zinc-800 bg-zinc-950 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button
            onClick={onBack}
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
          >
            ← Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isRoomActive ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
              ></div>
              <h2 className="text-lg font-semibold">
                {isRoomActive ? "Live Monitoring" : "Chat Ended"}
              </h2>
            </div>
            <p className="text-sm text-zinc-500">
              Room: <span className="font-mono text-purple-400">{roomId}</span>
              {!isRoomActive && (
                <span className="ml-2 text-amber-500/70">
                  (History preserved)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">{children}</div>
      </div>
    </div>
  );
}
