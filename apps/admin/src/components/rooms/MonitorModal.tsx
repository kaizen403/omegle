"use client";

import { Button } from "@/components/ui/button";
import { Room } from "@/types/socket";
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

  // Get alternating colors for different users
  const getUserColor = useCallback((sender: string) => {
    const colors = [
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-emerald-500 to-teal-500",
      "from-orange-500 to-red-500",
      "from-violet-500 to-purple-500",
      "from-rose-500 to-pink-500",
    ];
    const hash = sender
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }, []);

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

  return (
    <div
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-gradient-to-b from-white to-sky-50 border border-sky-100/50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with gradient and status */}
        <div className="relative flex items-center justify-between p-4 sm:p-5 border-b border-sky-100/50 bg-gradient-to-r from-sky-50 via-white to-[#e8f4f8]">
          <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
          <div className="min-w-0 flex-1 pr-2 relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 mb-1 flex-wrap">
              <div
                className={`w-2 h-2 rounded-full shadow-lg ${isRoomActive ? "bg-green-500 animate-pulse shadow-green-500/50" : "bg-gray-500 shadow-gray-500/50"}`}
              ></div>
              <h2 className="text-lg sm:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-[#0084d1]">
                Room Monitor
              </h2>
              {/* Status Badge */}
              <span
                className={`text-[10px] sm:text-xs font-bold px-2 py-1 rounded-full border ${
                  isRoomActive
                    ? "bg-green-900/30 text-green-400 border-green-700/50"
                    : "bg-gray-900/30 text-gray-400 border-gray-700/50"
                }`}
              >
                {isRoomActive ? "● LIVE" : "○ ENDED"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs text-slate-500">
                Room ID:
              </span>
              <code className="text-[10px] sm:text-xs text-slate-500 font-mono bg-sky-50/50 px-2 py-0.5 rounded border border-sky-200/50">
                {monitoringRoomId.slice(0, 8)}...{monitoringRoomId.slice(-4)}
              </code>
              {!isRoomActive && messages.length > 0 && (
                <span className="text-[10px] text-amber-500/70 italic">
                  (Chat history preserved)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
            {/* Export button in header - always visible */}
            {messages.length > 0 && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 text-xs px-3 py-2 h-9 transition-all duration-200 border border-blue-900/30 hover:border-blue-700/50 shadow-lg"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Export</span>
                  <svg
                    className={`w-3 h-3 ml-1 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </Button>

                {/* Export dropdown menu */}
                {showExportMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-sky-50 border border-sky-200 rounded-lg shadow-2xl overflow-hidden z-50 animate-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        handleExportJSON();
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-blue-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                        />
                      </svg>
                      <div className="text-left min-w-0">
                        <div className="font-medium">Export as JSON</div>
                        <div className="text-xs text-slate-500 truncate">
                          Structured data
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleExportTXT();
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-green-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <div className="text-left min-w-0">
                        <div className="font-medium">Export as TXT</div>
                        <div className="text-xs text-slate-500 truncate">
                          Plain text
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        handleCopyToClipboard();
                        setShowExportMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors border-t border-sky-200"
                    >
                      <svg
                        className="w-4 h-4 text-purple-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <div className="text-left min-w-0">
                        <div className="font-medium">Copy to Clipboard</div>
                        <div className="text-xs text-slate-500 truncate">
                          Quick copy
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Export success indicator */}
            {exportSuccess && (
              <div className="flex items-center gap-1.5 bg-green-900/30 px-2.5 py-1.5 rounded-lg border border-green-700/50 animate-in fade-in duration-200">
                <svg
                  className="w-3.5 h-3.5 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-xs text-green-400 font-medium hidden sm:inline">
                  Exported!
                </span>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-[#0084d1] hover:bg-sky-50/50 text-xs px-3 py-2 h-9 transition-all duration-200 border border-transparent hover:border-sky-200"
              onClick={onClose}
            >
              <svg
                className="w-4 h-4 mr-1.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Close
            </Button>
          </div>
        </div>

        {/* Chat Messages with enhanced styling */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 sm:space-y-4 bg-gradient-to-b from-white to-[#e8f4f8]">
          {messages.length === 0 ? (
            <div className="text-center py-16 animate-in fade-in duration-500">
              <div className="relative inline-flex mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <svg
                  className="w-20 h-20 relative z-10 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <p className="text-slate-500 text-sm sm:text-base font-medium">
                Waiting for messages...
              </p>
              <p className="text-slate-500 text-xs sm:text-sm mt-2">
                Messages will appear here in real-time
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const sender = msg.message?.sender || "Unknown";
                const gradientClass = getUserColor(sender);

                return (
                  <div
                    key={idx}
                    className="group animate-in slide-in-from-bottom-4 duration-300"
                    style={{ animationDelay: `${Math.min(idx * 50, 500)}ms` }}
                  >
                    <div className="relative bg-sky-50/40 backdrop-blur-sm rounded-2xl p-3 sm:p-4 border border-sky-200/50 hover:border-sky-300/50 transition-all duration-200 hover:shadow-lg hover:shadow-zinc-900/50">
                      {/* Message header with user info */}
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          {/* User avatar with gradient */}
                          <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-lg flex-shrink-0`}
                          >
                            {sender.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-xs sm:text-sm bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent truncate`}
                              >
                                User {sender.slice(-4)}
                              </span>
                              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-500 bg-sky-50/50 px-2 py-0.5 rounded-full border border-sky-200/30">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                UID: {sender}
                              </span>
                            </div>
                            <span className="sm:hidden text-[9px] text-slate-500 font-mono">
                              ID: {sender}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp with icon */}
                        <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-500 whitespace-nowrap flex-shrink-0 bg-sky-50/30 px-2 py-1 rounded-lg">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {new Date(msg.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      {/* Message content with better styling */}
                      <div className="relative">
                        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500/50 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                        <p className="text-slate-800 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words pl-3 sm:pl-4">
                          {msg.message?.content || (
                            <span className="text-slate-500 italic">
                              No content
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Message number indicator */}
                      <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-purple-500 to-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        #{idx + 1}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Modal Footer with enhanced design and export */}
        <div className="p-4 sm:p-5 border-t border-sky-100/50 bg-gradient-to-r from-white via-sky-50 to-white backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Message count badge */}
              <div className="flex items-center gap-2 bg-sky-50/50 px-3 py-1.5 rounded-lg border border-sky-200/50">
                <svg
                  className="w-4 h-4 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <span className="text-xs sm:text-sm font-semibold text-slate-900">
                  {messages.length}
                </span>
                <span className="text-xs text-slate-500">
                  {messages.length === 1 ? "message" : "messages"}
                </span>
              </div>

              {/* Status badge */}
              <div
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
                  isRoomActive
                    ? "bg-green-900/20 border-green-700/30"
                    : "bg-gray-900/20 border-gray-700/30"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isRoomActive ? "bg-green-500 animate-pulse" : "bg-gray-500"}`}
                ></div>
                <span
                  className={`text-xs font-medium ${isRoomActive ? "text-green-400" : "text-gray-400"}`}
                >
                  {isRoomActive ? "Active" : "Ended"}
                </span>
              </div>

              {/* Export success indicator */}
              {exportSuccess && (
                <div className="flex items-center gap-1.5 bg-green-900/20 px-3 py-1.5 rounded-lg border border-green-700/30 animate-in fade-in duration-200">
                  <svg
                    className="w-3.5 h-3.5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="text-xs text-green-400 font-medium">
                    Exported!
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {/* Export dropdown */}
              {messages.length > 0 && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30 text-xs px-3 py-2 h-9 whitespace-nowrap transition-all duration-200 border border-blue-900/30 hover:border-blue-700/50"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    Export
                    <svg
                      className={`w-3 h-3 ml-1 transition-transform ${showExportMenu ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </Button>

                  {/* Export menu */}
                  {showExportMenu && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-sky-50 border border-sky-200 rounded-lg shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                      <button
                        onClick={() => {
                          handleExportJSON();
                          setShowExportMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                          />
                        </svg>
                        <div className="text-left">
                          <div className="font-medium">Export as JSON</div>
                          <div className="text-xs text-slate-500">
                            Structured data format
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          handleExportTXT();
                          setShowExportMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div className="text-left">
                          <div className="font-medium">Export as TXT</div>
                          <div className="text-xs text-slate-500">
                            Plain text format
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          handleCopyToClipboard();
                          setShowExportMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white hover:bg-zinc-700 transition-colors border-t border-sky-200"
                      >
                        <svg
                          className="w-4 h-4 text-purple-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <div className="text-left">
                          <div className="font-medium">Copy to Clipboard</div>
                          <div className="text-xs text-slate-500">
                            Quick copy
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Close room button - only show if room is active */}
              {isRoomActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/30 text-xs px-3 py-2 h-9 whitespace-nowrap transition-all duration-200 border border-red-900/30 hover:border-red-700/50 shadow-lg hover:shadow-red-900/20"
                  onClick={() => {
                    if (currentRoom) {
                      onCloseRoom(currentRoom.roomId);
                    }
                  }}
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  End Room
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default MonitorModal;
