export function formatDuration(
  createdAt: number,
  currentTime?: number,
): string {
  const now = currentTime ?? Math.floor(Date.now() / 1000);
  const duration = now - createdAt;

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function calculateAverageDuration(
  rooms: Array<{ createdAt: number }>,
  currentTime: number,
): number {
  if (rooms.length === 0) return 0;

  const totalElapsed = rooms.reduce((acc, r) => {
    const elapsed =
      typeof r.createdAt === "number" ? currentTime - r.createdAt : 0;
    return acc + elapsed;
  }, 0);

  return Math.floor(totalElapsed / rooms.length / 60);
}
