/**
 * Type definitions for Socket/Real-time state
 */

export interface RoomUser {
  uid: number;
  name: string;
  gender: string;
}

export interface Room {
  roomId: string;
  user1: RoomUser;
  user2: RoomUser;
  createdAt: number;
  status?: "active" | "closed";
  messageCount?: number;
}

export interface User {
  uid: number;
  name: string;
  gender: string;
  state: "idle" | "queue" | "active" | "disconnected";
  roomId?: string;
  partnerId?: number;
  clientIP?: string;
  userAgent?: string;
  socketId?: string;
}

export interface QueueStats {
  male: number;
  female: number;
  total: number;
  averageWaitTime?: number;
  longestWaitTime?: number;
  recentMatches?: number;
  matchSuccessRate?: number;
}

export interface SystemHealth {
  status?: string;
  timestamp?: number;
  uptime: number;
  totalConnections?: number;
  activeRooms?: number;
  queuedUsers?: number;
  idleUsers?: number;
  activeUsers?: number;
  totalUsers?: number;
  nodeVersion?: string;
  redisHealthy?: boolean;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    arrayBuffers?: number;
  };
  cpu?: {
    usage: number;
    cores: number;
    user?: number;
    system?: number;
  };
  connections?: {
    total: number;
    authenticated: number;
    unauthenticated: number;
  };
  rooms?: {
    active: number;
    total?: number;
    waiting?: number;
  };
  queue?: {
    male: number;
    female: number;
    total: number;
  };
  redis?: {
    connected: boolean;
    usedMemory?: string;
    connectedClients?: number;
    uptimeInDays?: number;
  };
  cloudRun?: {
    service?: string;
    serviceName?: string;
    revision?: string;
    configuration?: string;
    region?: string;
    url?: string;
    instanceId?: string;
    memoryLimit?: string;
    cpuLimit?: string;
    maxInstances?: string;
    minInstances?: string;
    concurrency?: string;
    timeoutSeconds?: string;
    port?: string | number;
  };
  turn?: {
    configured: boolean;
    host: string;
  };
  kubernetes?: {
    podName: string;
    namespace: string;
    nodeName: string;
    cluster: string;
    podIP: string;
    isKubernetes: boolean;
  };
  redisDetails?: {
    available: boolean;
    host?: string;
    port?: number;
    tier?: string;
    error?: string;
    [key: string]: string | number | boolean | undefined;
  };
  errors?: {
    last5Minutes: number;
    topErrors: Array<{ message: string; count: number }>;
    totalTracked: number;
  };
  matchmaking?: {
    totalMatches: number;
    matchesPerMinute: number;
    avgMatchTime: number;
    failedMatches: number;
    successRate: number;
  };
  network?: {
    totalConnections: number;
    connectionsPerSecond: number;
    disconnections: number;
    disconnectRate: number;
    activeWebSockets: number;
  };
  performance?: {
    requestsPerMinute: number;
    avgResponseTime: number;
    totalRequests: number;
  };
}

export interface RedisMetrics {
  connected: boolean;
  keyCount?: number;
  memoryUsage?: number;
  circuitBreakerStatus?: string;
  lastError?: string | null;
  timestamp?: number;
  usedMemory?: string;
  peakMemory?: string;
  connectedClients?: number;
  blockedClients?: number;
  totalConnections?: number;
  opsPerSecond?: number;
  hitRate?: string;
  uptimeInDays?: number;
  version?: string;
  mode?: string;
  role?: string;
  fragmentationRatio?: string;
  evictedKeys?: number;
  expiredKeys?: number;
  error?: string;
}

export interface SystemEvent {
  type: string;
  timestamp: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MonitoredRoom {
  roomId: string;
  messages: RoomMessage[];
  participants: RoomUser[];
}

export interface RoomMessage {
  id?: string;
  roomId?: string;
  senderId?: number;
  senderName?: string;
  content?: string;
  timestamp: number;
  type?: "text" | "system";
  message?: {
    sender: string;
    content: string;
    type?: string;
  };
  sender?: string;
}

/**
 * Real-time analytics snapshot pushed on the `/admin` namespace every 2s.
 * No request is needed - the server sends it unprompted once authenticated.
 *
 * `live.*` describes the current instant, `cumulative.*` are durable counters
 * that survive API restarts (so they are deployment totals, not session
 * totals), and `rates.*` are server-computed per-minute rates.
 */
export interface AnalyticsSnapshot {
  live: {
    connectedUsers: number;
    idle: number;
    queued: number;
    active: number;
    activeRooms: number;
    male: number;
    female: number;
    monitoredRooms: number;
  };
  cumulative: {
    roomsCreatedTotal: number;
    roomsCreatedToday: number;
    matchesTotal: number;
    messagesTotal: number;
    peakConcurrentUsers: number;
    visitsToday: number;
  };
  rates: {
    matchesPerMinute: number;
    connectionsPerMinute: number;
    messagesPerMinute: number;
  };
  health: {
    uptimeSeconds: number;
    redisHealthy: boolean;
    memoryMB: number;
    errorsLast5Min: number;
  };
  timestamp: number;
}

/**
 * Payload of the `system_status` event. `status: true` means the public site
 * is live; `maintenance: true` is its inverse and means the site is down.
 */
export interface SystemStatusEvent {
  status: boolean;
  maintenance: boolean;
  message: string | null;
  changedBy: string;
  timestamp: number;
}

/**
 * Dashboard-side mirror of the last known public-site status, including who
 * changed it, so a toggle by another admin is attributable in the UI.
 */
export interface MaintenanceState {
  /** true = public site is live, false = maintenance mode */
  status: boolean;
  /** Optional note shown to end users while the site is down. */
  message: string | null;
  changedBy: string | null;
  changedAt: number | null;
}
