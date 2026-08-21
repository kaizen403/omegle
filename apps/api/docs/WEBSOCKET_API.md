# WebSocket API Documentation

## Overview

The backend exposes two Socket.IO namespaces:

1. **Default Namespace (`/`)**: User-facing matchmaking and chat
2. **Admin Namespace (`/admin`)**: Administrative monitoring and control

## Connection

### User Connection

```javascript
import { io } from 'socket.io-client';

const socket = io('https://api.vitap.in', {
  query: {
    apiKey: 'your-api-key-here',
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});
```

### Admin Connection

```javascript
const adminSocket = io('https://api.vitap.in/admin', {
  auth: {
    token: 'better-auth-session-token',
  },
  reconnection: true,
});
```

## User API (Default Namespace)

### Authentication

#### `auth` - Authenticate User

**Client → Server**

```javascript
socket.emit('auth', {
  uid: 12345,
  name: 'John Doe',
  gender: 'male', // 'male' | 'female'
});
```

**Server → Client**

```javascript
socket.on('auth_success', (data) => {
  console.log(data);
  // {
  //   success: true,
  //   message: 'Authentication successful',
  //   session: {
  //     uid: 12345,
  //     name: 'John Doe',
  //     gender: 'male',
  //     state: 'idle'
  //   }
  // }
});

socket.on('auth_error', (data) => {
  console.error(data);
  // {
  //   success: false,
  //   message: 'Invalid credentials'
  // }
});
```

### Matchmaking

#### `search` - Join Matchmaking Queue

**Client → Server**

```javascript
socket.emit('search', {
  gender: 'any', // 'male' | 'female' | 'any'
});
```

**Server → Client**

```javascript
// When match is found
socket.on('match', (data) => {
  console.log('Matched with partner!', data);
  // {
  //   roomId: 'room_abc123',
  //   partner: {
  //     uid: 67890,
  //     name: 'Jane Smith',
  //     gender: 'female'
  //   },
  //   channelName: 'channel_abc123',
  //   isOfferer: true,
  //   iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
  //   rtcEnabled: true,
  //   expiresAt: 1701460800
  // }
});

// While waiting in queue
socket.on('queue_update', (data) => {
  // { queueSize: 10, estimatedWait: 15 }
});
```

#### `cancel` - Cancel Search

**Client → Server**

```javascript
socket.emit('cancel');
```

**Server → Client**

```javascript
socket.on('search_cancelled', () => {
  console.log('Search cancelled, back to idle');
});
```

### Chat & Signaling

#### `message` - Send Chat Message

**Client → Server**

```javascript
socket.emit('message', {
  content: 'Hello!',
});
```

**Server → Client**

```javascript
socket.on('message', (data) => {
  console.log('New message:', data);
  // {
  //   roomId: 'room_abc123',
  //   sender: 67890,
  //   senderName: 'Jane Smith',
  //   content: 'Hello!',
  //   timestamp: 1701453600000
  // }
});
```

#### `signal` - WebRTC Signaling

**Client → Server**

```javascript
socket.emit('signal', {
  type: 'offer',
  data: {
    sdp: '...',
    type: 'offer',
  },
});
```

**Server → Client**

```javascript
socket.on('signal', (data) => {
  // Forward signaling data to peer
  // {
  //   from: 67890,
  //   type: 'answer',
  //   data: { sdp: '...', type: 'answer' }
  // }
});
```

### Room Management

#### `leave` - Leave Current Room

**Client → Server**

```javascript
socket.emit('leave');
```

**Server → Client**

```javascript
socket.on('partner_left', (data) => {
  console.log('Partner left the room');
  // { reason: 'user_left' }
});

socket.on('leave_success', () => {
  console.log('Successfully left room');
});
```

#### `next` - Find Next Partner

**Client → Server**

```javascript
socket.emit('next', {
  gender: 'any',
});
```

This is equivalent to:

1. Leave current room
2. Join search queue immediately

### Error Handling

```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data);
  // {
  //   message: 'Error description',
  //   code: 'ERROR_CODE',
  //   details: {...}
  // }
});

socket.on('kicked', (data) => {
  console.log('You were kicked by admin');
  // { reason: 'Violation of terms' }
});
```

### Connection Events

```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // reason: 'transport close' | 'io server disconnect' | ...
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_error', (error) => {
  console.error('Reconnection failed:', error);
});
```

## Admin API (`/admin` Namespace)

### Authentication

Admin connections authenticate with a Better Auth session token or cookie:

```javascript
const adminSocket = io('/admin', {
  withCredentials: true,
  auth: { token: sessionToken },
});

adminSocket.on('auth_response', (data) => {
  if (data.success) {
    console.log('Admin authenticated');
  }
});

adminSocket.on('session_revoked', () => {
  // Admin session was revoked by super admin
  console.log('Session revoked, please login again');
});
```

### Monitoring

#### `get_users` - Get All Active Users

**Client → Server**

```javascript
adminSocket.emit('get_users');
```

**Server → Client**

```javascript
adminSocket.on('users_list', (data) => {
  console.log('Active users:', data.users);
  // {
  //   users: [
  //     {
  //       uid: 12345,
  //       name: 'John Doe',
  //       gender: 'male',
  //       state: 'in_room', // 'idle' | 'in_queue' | 'in_room'
  //       roomId: 'room_abc123',
  //       socketId: 'socket_xyz',
  //       connectedAt: 1701453600000
  //     },
  //     ...
  //   ]
  // }
});
```

#### `get_rooms` - Get All Active Rooms

**Client → Server**

```javascript
adminSocket.emit('get_rooms');
```

**Server → Client**

```javascript
adminSocket.on('rooms_list', (data) => {
  console.log('Active rooms:', data.rooms);
  // {
  //   rooms: [
  //     {
  //       roomId: 'room_abc123',
  //       channelName: 'channel_abc123',
  //       user1: {
  //         uid: 12345,
  //         name: 'John Doe',
  //         gender: 'male'
  //       },
  //       user2: {
  //         uid: 67890,
  //         name: 'Jane Smith',
  //         gender: 'female'
  //       },
  //       startTime: 1701453600000,
  //       messageCount: 15
  //     },
  //     ...
  //   ]
  // }
});
```

#### Real-time Updates

```javascript
// User state changes
adminSocket.on('user_update', (user) => {
  console.log('User updated:', user);
});

// New room created
adminSocket.on('room_created', (room) => {
  console.log('New room:', room);
});

// Room deleted
adminSocket.on('room_deleted', (data) => {
  console.log('Room deleted:', data.roomId);
});
```

### Room Monitoring

#### `monitor_room` - Start Monitoring Room Chat

**Client → Server**

```javascript
adminSocket.emit('monitor_room', {
  roomId: 'room_abc123',
});
```

**Server → Client**

```javascript
adminSocket.on('monitor_started', (data) => {
  console.log('Monitoring started:', data);
  // {
  //   roomId: 'room_abc123',
  //   history: [
  //     { sender: 12345, content: 'Hi', timestamp: 1701453600000 },
  //     ...
  //   ]
  // }
});

// Live messages
adminSocket.on('room_message', (message) => {
  console.log('Room message:', message);
  // {
  //   roomId: 'room_abc123',
  //   message: {
  //     sender: 12345,
  //     content: 'Hello',
  //     timestamp: 1701453600000
  //   }
  // }
});
```

#### `unmonitor_room` - Stop Monitoring

**Client → Server**

```javascript
adminSocket.emit('unmonitor_room', {
  roomId: 'room_abc123',
});
```

#### `signal` - Relay WebRTC SDP / ICE

**Client → Server** (only while `state === 'active'` in a room)

```javascript
socket.emit('signal', { type: 'offer', sdp: '...' });
socket.emit('signal', { type: 'answer', sdp: '...' });
socket.emit('signal', {
  type: 'candidate',
  candidate: '...',
  sdpMid: '0',
  sdpMLineIndex: 0,
});
```

The server forwards the payload to the partner in the same Socket.IO room. It does not inspect SDP.

### User Management

#### `kick_user` - Disconnect User

**Client → Server**

```javascript
adminSocket.emit('kick_user', {
  uid: 12345,
});
```

#### `bulk_kick_users` - Kick Multiple Users

**Client → Server**

```javascript
adminSocket.emit('bulk_kick_users', {
  uids: [12345, 67890, 111213],
});
```

#### `disconnect_user` - Forcefully Disconnect User

**Client → Server**

```javascript
adminSocket.emit('disconnect_user', {
  uid: 12345,
});
```

### Room Management

#### `close_room` - Close Active Room

**Client → Server**

```javascript
adminSocket.emit('close_room', {
  roomId: 'room_abc123',
});
```

### Queue Management

#### `get_queue_stats` - Get Queue Statistics

**Client → Server**

```javascript
adminSocket.emit('get_queue_stats');
```

**Server → Client**

```javascript
adminSocket.on('queue_stats', (data) => {
  console.log('Queue stats:', data);
  // {
  //   totalInQueue: 25,
  //   maleCount: 15,
  //   femaleCount: 10,
  //   oldestWaitTime: 120000 // ms
  // }
});
```

#### `clear_queue` - Clear Matchmaking Queue

**Client → Server**

```javascript
adminSocket.emit('clear_queue', {
  gender: 'all', // 'male' | 'female' | 'all'
});
```

### System Health

#### `get_system_health` - Get System Status

**Client → Server**

```javascript
adminSocket.emit('get_system_health');
```

**Server → Client**

```javascript
adminSocket.on('system_health', (data) => {
  console.log('System health:', data);
  // {
  //   uptime: 3600,
  //   memoryUsage: {
  //     rss: 104857600,
  //     heapUsed: 52428800
  //   },
  //   redisHealthy: true,
  //   activeConnections: 150,
  //   cpuUsage: {
  //     user: 1234567,
  //     system: 234567
  //   }
  // }
});
```

#### `get_redis_metrics` - Get Redis Metrics

**Client → Server**

```javascript
adminSocket.emit('get_redis_metrics');
```

**Server → Client**

```javascript
adminSocket.on('redis_metrics', (data) => {
  console.log('Redis metrics:', data);
  // {
  //   connected: true,
  //   keyCount: 1234,
  //   memoryUsage: 5242880,
  //   circuitBreakerStatus: 'closed',
  //   lastError: null,
  //   timestamp: 1701453600000
  // }
});
```

#### `reset_circuit_breaker` - Reset Redis Circuit Breaker

**Client → Server**

```javascript
adminSocket.emit('reset_circuit_breaker');
```

### Events

```javascript
// System events
adminSocket.on('admin_event', (event) => {
  console.log('Admin event:', event);
  // {
  //   type: 'user_kicked' | 'room_closed' | 'queue_cleared',
  //   data: {...},
  //   timestamp: 1701453600000
  // }
});

// User errors
adminSocket.on('user_error', (error) => {
  console.log('User error:', error);
  // {
  //   uid: 12345,
  //   error: 'Connection timeout',
  //   timestamp: 1701453600000
  // }
});

// System status changes
adminSocket.on('system_status', (data) => {
  console.log('System status:', data);
  // { status: true } // true = online, false = offline
});
```

## Rate Limiting

### User Connections

- **Connection limit**: 1 connection per user (uid)
- **Message rate**: 10 messages burst, 2 messages/sec refill
- **Reconnection delay**: 1s → 2s → 4s → 8s (exponential backoff)

### Admin Connections

- **No rate limiting** on admin namespace
- **Session timeout**: 24 hours
- **Concurrent sessions**: Unlimited per admin

## Error Codes

```javascript
// Authentication errors
AUTH_REQUIRED; // No authentication provided
AUTH_FAILED; // Invalid credentials
AUTH_EXPIRED; // Token expired
SESSION_REVOKED; // Admin revoked session

// Matchmaking errors
ALREADY_IN_QUEUE; // User already searching
ALREADY_IN_ROOM; // User already in a room
MATCH_TIMEOUT; // No match found in time
QUEUE_FULL; // Queue at capacity

// Room errors
ROOM_NOT_FOUND; // Room doesn't exist
ROOM_CLOSED; // Room was closed
PARTNER_LEFT; // Partner disconnected

// System errors
REDIS_ERROR; // Redis operation failed
SERVER_ERROR; // Internal server error
RATE_LIMIT_EXCEEDED; // Too many requests
```

## Best Practices

### User Client

1. **Reconnection Handling**

```javascript
socket.on('connect', () => {
  // Re-authenticate after reconnection
  socket.emit('auth', { uid, name, gender });
});
```

2. **State Management**

```javascript
let currentState = 'idle'; // 'idle' | 'in_queue' | 'in_room'

socket.on('queue_update', () => {
  currentState = 'in_queue';
});

socket.on('match', () => {
  currentState = 'in_room';
});
```

3. **Error Recovery**

```javascript
socket.on('error', (data) => {
  if (data.code === 'MATCH_TIMEOUT') {
    // Retry search after delay
    setTimeout(() => {
      socket.emit('search', { gender: 'any' });
    }, 2000);
  }
});
```

### Admin Client

1. **Periodic Refresh**

```javascript
setInterval(() => {
  adminSocket.emit('get_users');
  adminSocket.emit('get_rooms');
  adminSocket.emit('get_queue_stats');
}, 30000); // Every 30 seconds
```

2. **Handle Disconnections**

```javascript
adminSocket.on('disconnect', () => {
  // Clear local state
  users = [];
  rooms = [];
});

adminSocket.on('reconnect', () => {
  // Refresh data after reconnection
  adminSocket.emit('get_users');
  adminSocket.emit('get_rooms');
});
```

3. **Monitor Memory**

```javascript
// Limit stored messages
const roomMessages = new Map();

adminSocket.on('room_message', (msg) => {
  const messages = roomMessages.get(msg.roomId) || [];
  messages.push(msg.message);

  // Keep only last 100 messages
  if (messages.length > 100) {
    messages.shift();
  }

  roomMessages.set(msg.roomId, messages);
});
```

---

**API Version**: 1.0  
**Last Updated**: December 2025  
**Protocol**: Socket.IO v4.x
