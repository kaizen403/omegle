"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { ArchiveService } from "@/lib/services/archiveService";
import { ChatArchive, ChatArchiveDetail } from "@/types/archive";
import { ArchiveRow, ArchiveDetailModal } from "@/components/archives";

export default function ArchivesPage() {
  const { logout } = useAuth();
  const [archives, setArchives] = useState<ChatArchive[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ChatArchiveDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingRoomId, setLoadingRoomId] = useState<string | null>(null);
  const initialLoadRef = useRef(false);

  const load = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await ArchiveService.fetchArchives(page, pageSize);
        setArchives(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load archives");
      } finally {
        setLoading(false);
      }
    },
    [pageSize],
  );

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      void load(1);
    }
  }, [load]);

  const open = useCallback(async (archive: ChatArchive) => {
    setLoadingRoomId(archive.roomId);
    setLoadingDetail(true);
    try {
      const data = await ArchiveService.fetchArchive(archive.roomId);
      setSelected(data);
    } catch {
      setSelected(null);
    } finally {
      setLoadingDetail(false);
      setLoadingRoomId(null);
    }
  }, []);

  const close = useCallback(() => setSelected(null), []);
  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(page);
      void load(page);
    },
    [load],
  );

  return (
    <AdminLayout onLogout={logout}>
      <PageHeader
        title="Archives"
        action={
          <button
            onClick={() => goToPage(currentPage)}
            disabled={loading}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-60 text-slate-600"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        }
      />

      <div className="p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-sky-100 rounded-lg overflow-hidden"
        >
          <div className="border-b border-gray-200 px-4 py-3">
            <div className="grid grid-cols-[1fr_1fr_90px_170px_120px] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>User 1</span>
              <span>User 2</span>
              <span className="text-right">Messages</span>
              <span>Started</span>
              <span>Ended</span>
            </div>
          </div>

          {loading && archives.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">
              Loading archives…
            </p>
          ) : error ? (
            <p className="p-8 text-center text-red-500 text-sm">{error}</p>
          ) : archives.length === 0 ? (
            <p className="p-8 text-center text-slate-500 text-sm">
              No archived chats yet. Archived rooms will appear here once chat
              sessions have ended.
            </p>
          ) : (
            <div>
              {archives.map((archive, index) => (
                <ArchiveRow
                  key={archive.roomId}
                  archive={archive}
                  index={index}
                  loading={loadingRoomId === archive.roomId}
                  onOpen={open}
                />
              ))}

              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-sm">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </button>
                <span className="text-xs text-slate-500 tabular-nums">
                  Page {currentPage}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={archives.length < pageSize || loading}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <ArchiveDetailModal
        detail={selected}
        loading={loadingDetail}
        onClose={close}
      />
    </AdminLayout>
  );
}
