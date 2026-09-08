"use client";

import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";
import { Room } from "@/contexts/AdminSocketContext";
import {
  EmptyState,
  IdChip,
  Section,
  StatusPill,
  TableShell,
  Td,
  Th,
  Tr,
} from "@/components/console";
import { Button } from "@/components/ui/button";
import { formatDuration } from "./utils";
import { useAuth } from "@/contexts/AuthProvider";

interface RoomTableProps {
  rooms: Room[];
  onCloseRoom: (roomId: string) => void;
  searchQuery: string;
  currentTime: number;
}

type Participant = Room["user1"];

/**
 * One participant on a single line: name, gender, id.
 *
 * The name is the only growing child (`min-w-0` + `truncate`); the gender word
 * and the id chip are `shrink-0`, so a long name cannot push the id out of the
 * cell and over the next column.
 */
function ParticipantLine({ user }: { user: Participant }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {user.name}
      </span>
      {user.gender && (
        <span className="hidden shrink-0 text-xs text-muted-foreground capitalize sm:inline">
          {user.gender}
        </span>
      )}
      <IdChip
        value={String(user.uid).slice(-6)}
        title={String(user.uid)}
        className="hidden shrink-0 sm:inline-flex"
      />
    </div>
  );
}

export default function RoomTable({
  rooms,
  onCloseRoom,
  searchQuery,
  currentTime,
}: RoomTableProps) {
  const router = useRouter();
  // Monitoring is allowed for any signed-in admin (0cc7fb3). Takeover actions are still super-admin-gated server-side.
  const { admin } = useAuth();
  void admin;

  return (
    <Section
      title="Rooms"
      description={
        rooms.length === 1 ? "1 conversation" : `${rooms.length} conversations`
      }
      contentClassName="p-0"
      className="overflow-hidden"
    >
      {rooms.length === 0 ? (
        <EmptyState
          title="No active rooms"
          description={
            searchQuery
              ? "No rooms match your search."
              : "Waiting for users to connect."
          }
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th width="6.5rem">Status</Th>
              <Th width="8rem">Room</Th>
              <Th>Participants</Th>
              <Th className="hidden md:table-cell" width="7rem">
                Duration
              </Th>
              <Th className="hidden lg:table-cell" align="right" width="6rem">
                Messages
              </Th>
              <Th align="right" width="12rem">
                Actions
              </Th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const isLive = room.status !== "closed";

              return (
                <Tr key={room.roomId}>
                  <Td>
                    <StatusPill tone={isLive ? "success" : "neutral"} dot>
                      {isLive ? "Live" : "Closed"}
                    </StatusPill>
                  </Td>

                  <Td>
                    <IdChip
                      value={room.roomId.slice(0, 8)}
                      title={room.roomId}
                    />
                  </Td>

                  <Td>
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <ParticipantLine user={room.user1} />
                      <ParticipantLine user={room.user2} />
                    </div>
                  </Td>

                  <Td className="hidden md:table-cell">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatDuration(room.createdAt, currentTime)}
                    </span>
                  </Td>

                  <Td align="right" className="hidden lg:table-cell">
                    <span className="text-sm font-medium tabular-nums text-foreground">
                      {room.messageCount ?? 0}
                    </span>
                  </Td>

                  <Td align="right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/home/rooms?monitor=${room.roomId}`)
                        }
                      >
                        <Eye className="size-4" strokeWidth={2} />
                        Monitor
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onCloseRoom(room.roomId)}
                        className="text-danger hover:bg-danger-surface hover:text-danger"
                      >
                        <X className="size-4" strokeWidth={2} />
                        End
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </TableShell>
      )}
    </Section>
  );
}
