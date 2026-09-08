import type { Room, User } from "@/types/socket";

/**
 * Stable ordering for the live user and room lists.
 *
 * Why this exists: the socket layer replaces `users`/`rooms` wholesale on every
 * `initial_state`, `users_list` and `rooms_list` push, and rebuilds them from a
 * Map on every `*_batch`. Both produce whatever order the server happened to
 * emit, which changes between ticks. With no sort of its own the table rendered
 * rows in that order, so every few seconds the same people appeared at a
 * different height — the "names keep rotating up and down" problem.
 *
 * The fix is to order by something that does not change while a row is on
 * screen, and to always break ties on the immutable id. Sorting here rather
 * than in each page means every consumer gets the same stable order.
 */

/** Ascending state weight: the interesting users sort to the top. */
const STATE_RANK: Record<string, number> = {
  active: 0,
  queue: 1,
  idle: 2,
};

/**
 * Users: by state, then by uid.
 *
 * Deliberately *not* grouped by roomId the way the Users page used to do it.
 * roomId changes every time a pair re-matches, so grouping on it re-sorted the
 * whole table each time anyone anywhere got a new partner. Pairing is still
 * visible per row; it no longer drives the row order.
 */
export function sortUsers<T extends Pick<User, "uid" | "state">>(
  users: readonly T[],
): T[] {
  return [...users].sort((a, b) => {
    const rank = (STATE_RANK[a.state] ?? 3) - (STATE_RANK[b.state] ?? 3);
    if (rank !== 0) return rank;
    return a.uid - b.uid;
  });
}

/**
 * Rooms: oldest conversation first, tie-broken on roomId.
 *
 * createdAt is fixed for the life of a room, so a room holds its position
 * until it closes, and new rooms append at the bottom instead of shuffling
 * the list.
 */
export function sortRooms<T extends Pick<Room, "roomId" | "createdAt">>(
  rooms: readonly T[],
): T[] {
  return [...rooms].sort((a, b) => {
    const byAge = (a.createdAt ?? 0) - (b.createdAt ?? 0);
    if (byAge !== 0) return byAge;
    return a.roomId.localeCompare(b.roomId);
  });
}
