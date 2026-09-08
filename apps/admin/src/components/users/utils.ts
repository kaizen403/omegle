import type { UserFingerprint } from "@/types/socket";

/**
 * The shape the users table renders. Mirrors the socket `User` but narrows
 * `state` to the three states this page can actually show, and carries the
 * optional fingerprint fields so rows no longer have to cast their way to
 * them.
 */
export interface User {
  uid: number;
  name: string;
  gender: string;
  state: "idle" | "queue" | "active";
  socketId?: string;
  roomId?: string;
  partnerId?: number;
  clientIP?: string;
  userAgent?: string;
  fingerprint?: UserFingerprint | null;
  fingerprintHash?: string | null;
  incidentCount?: number;
}

/**
 * @deprecated Row tinting by room is gone. The table used to sort by roomId so
 * pairs sat next to each other and could share a background tint; sorting on a
 * value that changes on every re-match is exactly what made rows jump around.
 * Kept only so existing callers and tests keep compiling.
 */
export const getRoomColor = (roomId: string | null): string => {
  if (!roomId) return "transparent";

  const colors = [
    "rgba(168, 85, 247, 0.1)", // purple
    "rgba(59, 130, 246, 0.1)", // blue
    "rgba(16, 185, 129, 0.1)", // green
    "rgba(245, 158, 11, 0.1)", // amber
    "rgba(239, 68, 68, 0.1)", // red
    "rgba(236, 72, 153, 0.1)", // pink
  ];

  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = roomId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

/**
 * @deprecated Adjacency no longer implies pairing. Each row now looks up its
 * own partner by `partnerId` instead.
 * Kept for compatibility with existing tests.
 */
export const isUserInSameRoomAsPrevious = (
  users: User[],
  currentIndex: number,
): boolean => {
  if (currentIndex === 0) return false;
  const currentUser = users[currentIndex];
  const previousUser = users[currentIndex - 1];
  return !!currentUser?.roomId && currentUser.roomId === previousUser?.roomId;
};
