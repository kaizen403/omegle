# Admin Panel - Omegle VITAP

> **Real-time monitoring and management dashboard for Omegle VITAP platform**

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Better Auth](https://img.shields.io/badge/Better%20Auth-1.4.3-orange)](https://www.better-auth.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.57.0-green?logo=playwright)](https://playwright.dev/)

Comprehensive admin dashboard for monitoring users, rooms, system health, and managing administrative operations for the Omegle VITAP platform.

## 🚀 Live Demo

- **Production**: [https://admin-omegle-vitap.web.app](https://admin-omegle-vitap.web.app)
- **Local Dev**: [http://localhost:3001](http://localhost:3001)

## 📸 Screenshots

![Dashboard Overview](docs/screenshots/dashboard.png)
![User Management](docs/screenshots/users.png)
![Room Monitoring](docs/screenshots/rooms.png)

## ✨ Features

### 🎛️ Real-Time Monitoring

- **Live Dashboard**: System metrics, active users, room statistics
- **WebSocket Integration**: Real-time updates via Socket.IO
- **System Health**: CPU, memory, Redis, circuit breaker status
- **User Tracking**: Online users with activity timestamps
- **Room Monitoring**: Active video chat rooms with participant details

### 👥 User Management

- View all users with search and filtering
- User activity history and session tracking
- Kick users from rooms or ban from platform
- Bulk user operations

### 🎥 Room Management

- Monitor active video chat rooms in real-time
- View room participants and connection status
- Listen to room audio streams (LiveKit integration)
- Close rooms or kick specific users
- Room duration tracking

### 🔐 Security & Authentication

- Better Auth authentication with email/password
- Multi-Factor Authentication (MFA) with TOTP (authenticator app)
- Cloudflare Turnstile protection
- Role-based access control (Super Admin, Admin, Moderator)
- Session management and auto-logout

### 📊 Analytics & Logs

- User connection logs with timestamps
- Room creation and closure events
- System event history
- Export logs to CSV/JSON

### 🤖 Bot Management

- Monitor bot accounts
- Configure bot behavior
- Bot performance metrics

### ⚡ Performance

- Optimized React 19 with Compiler
- Server-Side Rendering (SSR)
- Automatic code splitting
- Memory leak prevention in socket hooks
- Responsive design for mobile/tablet

## 🏗️ Tech Stack

### Frontend Framework

- **Next.js 16.0.3** - App Router, Server Components, Turbopack
- **React 19.2.0** - Latest stable with React Compiler
- **TypeScript 5.x** - Strict mode for type safety

### UI Components

- **Radix UI** - Accessible component primitives
- **Tailwind CSS 4** - Utility-first styling
- **Lucide React** - Icon library
- **Framer Motion** - Animations and transitions

### Real-Time Communication

- **Socket.IO Client 4.8.1** - WebSocket connection to backend
- **LiveKit Client 2.16.0** - Audio monitoring for rooms

### State Management

- **React Hooks** - useState, useEffect, useCallback
- **Context API** - Global state management
- **Custom Hooks** - useAdminSocket, useRoomMonitoring, useSecurityMonitor

### Authentication

- **Better Auth 1.4.3** - Email/password sign-in, TOTP two-factor auth, session cookies
- **Cloudflare Turnstile** - Bot protection on sign-in (`@marsidev/react-turnstile`)

### Testing

- **Playwright 1.57.0** - End-to-end testing (5 browsers)
- **Vitest 4.0.14** - Unit testing
- **Testing Library** - Component testing utilities

### Development Tools

- **ESLint 9** - Linting and code quality
- **Prettier 3.7.2** - Code formatting
- **Husky 9.1.7** - Git hooks
- **lint-staged** - Pre-commit hooks

## 📋 Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: >= 10.0.0 (recommended) or npm/yarn
- **Backend API**: Running backend instance (see `omegle-vitap-backend/`) with Better Auth mounted at `/api/auth/*`

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Navigate to admin panel directory
cd admin-omegle-vitap

# Install dependencies
pnpm install
# or
npm install
```

### 2. Environment Setup

Create `.env` file in the project root:

```env
# Backend API (Better Auth + admin REST + Socket.IO)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# Shared API key (must match backend)
NEXT_PUBLIC_API_KEY=your_api_key

# Cloudflare Turnstile (optional in dev; required in production)
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key
```

### 3. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

### 4. Create Admin Account

Use the backend scripts to create admin accounts:

```bash
# In backend directory
cd ../omeagle-vitap-backend
npm run create-test-admin
```

## 📦 Available Scripts

### Development

```bash
pnpm dev              # Start dev server on port 3001
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix ESLint issues
pnpm format           # Format code with Prettier
pnpm type-check       # TypeScript type checking
```

### Testing

```bash
pnpm test             # Run unit tests (watch mode)
pnpm test:run         # Run unit tests once
pnpm test:coverage    # Generate coverage report

# E2E Tests with Playwright
pnpm test:e2e         # Run all E2E tests
pnpm test:e2e:ui      # Open Playwright UI
pnpm test:e2e:headed  # Run with visible browser
pnpm test:e2e:debug   # Debug mode
pnpm test:e2e:report  # View HTML report
```

### Validation

```bash
pnpm validate         # Run all checks (type, lint, format, test)
```

## 🧪 Testing

### E2E Tests with Playwright

Comprehensive end-to-end tests covering critical user flows:

**Test Suites:**

- `tests/e2e/admin-login.spec.ts` - Authentication and MFA
- `tests/e2e/dashboard.spec.ts` - Dashboard functionality and real-time updates
- `tests/e2e/user-management.spec.ts` - User and room management operations

**Browser Coverage:**

- ✅ Chromium (Desktop)
- ✅ Firefox (Desktop)
- ✅ WebKit/Safari (Desktop)
- ✅ Mobile Chrome (Android)
- ✅ Mobile Safari (iOS)

```bash
# Run all tests
pnpm test:e2e

# Interactive mode
pnpm test:e2e:ui

# Debug specific test
pnpm test:e2e:debug tests/e2e/admin-login.spec.ts
```

**Test Results:** HTML reports generated in `playwright-report/`

### Unit Tests with Vitest

```bash
# Watch mode
pnpm test

# Single run with coverage
pnpm test:coverage
```

## 📁 Project Structure

```
admin-omegle-vitap/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Landing page
│   │   ├── providers.tsx      # Context providers
│   │   └── home/              # Dashboard routes
│   │       ├── dashboard/     # System overview
│   │       ├── users/         # User management
│   │       ├── rooms/         # Room monitoring
│   │       ├── admins/        # Admin management
│   │       ├── logs/          # Event logs
│   │       ├── bots/          # Bot management
│   │       ├── health/        # System health
│   │       └── user-history/  # User activity
│   │
│   ├── components/            # React components
│   │   ├── auth/              # Login, MFA components
│   │   ├── dashboard/         # Dashboard widgets
│   │   ├── users/             # User management UI
│   │   ├── rooms/             # Room monitoring UI
│   │   ├── layout/            # Layout components
│   │   ├── ui/                # Reusable UI components
│   │   └── app-sidebar.tsx    # Main navigation
│   │
│   ├── contexts/              # React Context
│   │   ├── AuthProvider.tsx   # Authentication state
│   │   └── AdminSocketContext.tsx  # WebSocket state
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useAdminSocket.ts  # WebSocket connection (optimized)
│   │   ├── useRoomMonitoring.ts  # Room monitoring
│   │   ├── useSecurityMonitor.ts # Security monitoring
│   │   ├── useAdminManagement.ts # Admin operations
│   │   ├── useRoomDuration.ts    # Room duration tracking
│   │   └── useRoomFilters.ts     # Room filtering logic
│   │
│   ├── lib/                   # Utility libraries
│   │   ├── auth-client.ts     # Better Auth client
│   │   ├── storage.ts         # Local storage helpers
│   │   ├── utils.ts           # General utilities
│   │   ├── validators.ts      # Input validation
│   │   ├── adminAudioService.ts  # LiveKit audio
│   │   ├── services/          # API services
│   │   └── security/          # Security utilities
│   │
│   ├── types/                 # TypeScript types
│   │   ├── admin.ts           # Admin types
│   │   ├── user.ts            # User types
│   │   ├── socket.ts          # Socket event types
│   │   └── index.ts           # Shared types
│   │
│   └── __tests__/             # Unit tests
│       └── setup.ts           # Test setup
│
├── tests/                     # E2E tests
│   └── e2e/
│       ├── README.md          # Testing guide
│       ├── admin-login.spec.ts
│       ├── dashboard.spec.ts
│       └── user-management.spec.ts
│
├── docs/                      # Documentation
│   └── DEPENDENCY_STATUS.md   # Dependency audit
│
├── public/                    # Static assets
│   └── index.html
│
├── playwright.config.ts       # Playwright configuration
├── vitest.config.ts          # Vitest configuration
├── next.config.ts            # Next.js configuration
├── tailwind.config.js        # Tailwind CSS config
├── tsconfig.json             # TypeScript config
└── package.json              # Dependencies and scripts
```

## 🔌 WebSocket Integration

### Connection Setup

```typescript
import { useAdminSocket } from "@/hooks/useAdminSocket";

function Dashboard() {
  const { socket, connected, users, rooms, systemStatus, events } =
    useAdminSocket();

  // Socket automatically connects on mount
  // and cleans up on unmount
}
```

### Socket Events (Admin Namespace)

**Incoming Events:**

- `admin_stats_update` - System statistics
- `users_update` - User list changes
- `rooms_update` - Room list changes
- `user_connected` - New user online
- `user_disconnected` - User went offline
- `room_created` - New room created
- `room_closed` - Room closed
- `system_health` - Health check data

**Outgoing Events:**

- `get_users` - Request user list
- `get_rooms` - Request room list
- `monitor_room` - Start monitoring room
- `kick_user` - Remove user from room
- `close_room` - Close video chat room
- `bulk_kick_users` - Kick multiple users
- `clear_queue` - Clear matchmaking queue

See backend [`docs/WEBSOCKET_API.md`](../omeagle-vitap-backend/docs/WEBSOCKET_API.md) for complete API reference.

## 🎨 UI Components

### Component Library

Built with **Radix UI** primitives for accessibility:

- **Button** - Primary, secondary, ghost, outline variants
- **Dialog/Modal** - Alert dialogs, confirmation modals
- **Dropdown Menu** - Context menus and actions
- **Select** - Dropdowns for filtering
- **Switch** - Toggle controls
- **Tabs** - Tabbed navigation
- **Tooltip** - Contextual help
- **Scroll Area** - Custom scrollbars
- **Slider** - Range inputs
- **Label** - Form labels

### Styling

**Tailwind CSS 4** with custom configuration:

```javascript
// tailwind.config.js
{
  theme: {
    extend: {
      colors: {
        primary: { /* custom palette */ },
        secondary: { /* custom palette */ },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    }
  }
}
```

## 🔐 Authentication Flow

### Email/Password Login

1. User enters email and password
2. Cloudflare Turnstile verification
3. Better Auth sign-in (`POST /api/auth/sign-in/email`)
4. TOTP verification (if enabled)
5. Admin role + `isActive` check against the backend (`/api/admin/verify`, session cookie)
6. Establish WebSocket connection (Better Auth session token)
7. Redirect to dashboard

### Multi-Factor Authentication

```typescript
// Sign in — Better Auth responds with twoFactorRedirect when TOTP is enabled
const { data, error } = await authClient.signIn.email(
  { email, password },
  { headers: { "x-captcha-response": turnstileToken } },
);

if (data?.twoFactorRedirect) {
  // Verify the 6-digit code from the authenticator app
  await authClient.twoFactor.verifyTotp({ code });
}
```

## 📊 System Architecture

```
┌─────────────────┐
│  Admin Panel    │
│  (Next.js 16)   │
│  Port: 3001     │
└────────┬────────┘
         │
         │ Socket.IO
         │
┌────────▼────────┐
│  Backend API    │
│  (Node.js 20)   │
│  Port: 8080     │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼───┐
│ Redis │ │LiveKit│
│Memstore│ │ GKE  │
└───────┘ └──────┘
```

**Data Flow:**

1. Admin Panel connects to backend via Socket.IO (admin namespace)
2. Backend streams real-time updates from Redis
3. LiveKit provides audio tokens for room monitoring
4. Better Auth handles authentication and admin role verification

## 🚀 Deployment

The app builds to a static export (`out/`) which can be served by any static
hosting. Deployment targets are managed with the infrastructure work.

```bash
# Validate and build for production
pnpm validate
pnpm build
```

### Environment Variables

Set production environment variables on your hosting provider:

```bash
NEXT_PUBLIC_BACKEND_URL="https://api.yourdomain.com"
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your_turnstile_site_key"
```

## 🔧 Configuration

### Next.js Config

```typescript
// next.config.ts
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    reactCompiler: true, // React 19 Compiler
    turbo: true, // Turbopack bundler
  },
  images: {
    // S3 public base URL for uploaded files
    domains: ["your-cdn-domain.com"],
  },
};
```

## 🐛 Troubleshooting

### Common Issues

**1. WebSocket Connection Failed**

```bash
# Check backend is running
curl http://localhost:8080/health

# Verify NEXT_PUBLIC_SOCKET_URL in .env
echo $NEXT_PUBLIC_SOCKET_URL
```

**2. Authentication Error**

```bash
# Check the backend is reachable and Better Auth is mounted
curl http://localhost:8080/api/auth/get-session

# Verify NEXT_PUBLIC_BACKEND_URL in .env
echo $NEXT_PUBLIC_BACKEND_URL
```

**3. Build Errors**

```bash
# Clear cache and rebuild
rm -rf .next
pnpm install
pnpm build
```

**4. Memory Leaks**

```bash
# The socket hook is optimized to prevent leaks
# If you still see issues, check:
# - useEffect cleanup functions
# - Socket listener removal
# - Interval cleanup
```

### Performance Optimization

**React Compiler:** Automatically optimizes components

```typescript
// No need for manual memoization
// React Compiler handles it automatically
```

**Code Splitting:**

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const AudioPlayer = dynamic(() => import('./AudioPlayer'), {
  ssr: false,
  loading: () => <div>Loading audio...</div>
});
```

## 📈 Performance Metrics

### Lighthouse Scores (Production)

- **Performance**: 95+
- **Accessibility**: 100
- **Best Practices**: 100
- **SEO**: 100

### Bundle Size

- **First Load JS**: ~250 KB (gzipped)
- **Route Chunks**: 30-80 KB each
- **Total Size**: ~2.5 MB (uncompressed)

### Memory Usage

- **Initial Load**: ~50 MB
- **After 1 hour**: ~120 MB
- **After 24 hours**: ~150 MB (with optimizations)
- **Memory Leak Prevention**: ✅ Implemented

## 🤝 Contributing

### Development Workflow

1. **Create Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**

   ```bash
   # Follow code style
   pnpm lint:fix
   pnpm format
   ```

3. **Test Thoroughly**

   ```bash
   pnpm validate
   pnpm test:e2e
   ```

4. **Commit with Convention**

   ```bash
   git commit -m "feat: add new feature"
   # or
   git commit -m "fix: resolve bug"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

### Commit Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🆘 Support

- **Documentation**: Check `docs/` directory
- **Backend API**: See [`../omeagle-vitap-backend/docs/`](../omeagle-vitap-backend/docs/)
- **Issues**: Open GitHub issue
- **Email**: support@yourdomain.com

## 🔗 Related Projects

- **Main Frontend**: [`../omegle-vitap/`](../omegle-vitap/) - User-facing application
- **Backend API**: [`../omeagle-vitap-backend/`](../omeagle-vitap-backend/) - Node.js WebSocket server

## 📝 Changelog

### v0.1.0 (December 2025)

- ✅ Initial release
- ✅ Real-time dashboard with WebSocket
- ✅ User and room management
- ✅ Better Auth authentication with TOTP MFA
- ✅ E2E tests with Playwright
- ✅ Memory leak fixes in socket hook
- ✅ React 19 and Next.js 16 stable
- ✅ Comprehensive documentation

---

**Built with ❤️ using Next.js 16, React 19, and TypeScript**
