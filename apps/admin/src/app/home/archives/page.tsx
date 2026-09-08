"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthProvider";
import AdminLayout from "@/components/layout/AdminLayout";
import PageHeader from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { EmptyState, PageBody, Section } from "@/components/console";
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
        description="Chat transcripts kept after a room ends"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage)}
            disabled={loading}
          >
            <RefreshCw
              className={loading ? "size-4 animate-spin" : "size-4"}
              strokeWidth={2}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      <PageBody>
        <Section
          title="Archived conversations"
          description="Open a conversation to read its full transcript."
          contentClassName="p-0"
        >
          {loading && archives.length === 0 ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3.5 sm:px-5"
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3.5 w-48 max-w-full animate-pulse rounded bg-muted" />
                    <div className="h-3 w-64 max-w-full animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-3.5 w-16 shrink-0 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : error ? (
            <EmptyState
              title="Could not load archives"
              description={error}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage)}
                  disabled={loading}
                >
                  <RefreshCw className="size-4" strokeWidth={2} />
                  Try again
                </Button>
              }
            />
          ) : archives.length === 0 ? (
            <EmptyState
              title="No archived chats yet"
              description="Conversations show up here once their room has ended."
            />
          ) : (
            <div>
              <div className="divide-y divide-border">
                {archives.map((archive, index) => (
                  <ArchiveRow
                    key={archive.roomId}
                    archive={archive}
                    index={index}
                    loading={loadingRoomId === archive.roomId}
                    onOpen={open}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-3 sm:px-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1 || loading}
                >
                  <ChevronLeft className="size-4" strokeWidth={2} />
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Page {currentPage}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={archives.length < pageSize || loading}
                >
                  Next
                  <ChevronRight className="size-4" strokeWidth={2} />
                </Button>
              </div>
            </div>
          )}
        </Section>
      </PageBody>

      <ArchiveDetailModal
        detail={selected}
        loading={loadingDetail}
        onClose={close}
      />
    </AdminLayout>
  );
}
