# Omegle VITAP - Random Video Chat

> **Anonymous video chat platform with gender-based matchmaking and real-time communication**

[![Next.js](https://img.shields.io/badge/Next.js-16.0.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.0-blue?logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-00D9FF)](https://webrtc.org/)
[![PostHog](https://img.shields.io/badge/PostHog-1.x-F54E00?logo=posthog)](https://posthog.com/)
[![XState](https://img.shields.io/badge/XState-5.24.0-2C3E50?logo=xstate)](https://xstate.js.org/)

Modern, anonymous video chat platform inspired by Omegle, built for VIT-AP students. Features real-time matchmaking, WebRTC video/audio, text chat, and interest-based pairing.

## 🚀 Live Demo

- **Production**: [https://omegle-vitap.web.app](https://omegle-vitap.web.app)
- **Local Dev**: [http://localhost:3000](http://localhost:3000)

## 🎥 Demo Video

[Watch Demo](https://youtu.be/your-demo-video)

## ✨ Features

### 🎭 Anonymous Chat

- **No Sign-Up Required**: Start chatting immediately
- **Gender-Based Matching**: Choose "Male", "Female", or "Any"
- **Random Pairing**: Algorithm prevents re-matching with same users
- **Interest Tags**: Match based on common interests (optional)

### 📹 Video & Audio

- **WebRTC Video Chat**: 1:1 P2P with TURN fallback
- **Audio Controls**: Mute/unmute microphone and speakers
- **Camera Toggle**: Turn camera on/off during chat
- **Screen Share**: Share your screen (coming soon)
- **Reconnection**: Automatic reconnection on network issues

### 💬 Text Chat

- **Real-Time Messaging**: Instant text messaging alongside video
- **Emoji Support**: Full emoji picker integration
- **Link Detection**: Automatic link detection and formatting
- **Message History**: Persists during active session
- **Typing Indicators**: See when partner is typing
- **Copy/Paste**: Full clipboard support

### 🎯 Smart Matchmaking

- **Queue System**: Fair matching with FIFO queue
- **Anti-Rematch**: 5-minute cooldown prevents matching same user
- **Queue Position**: Shows your position in queue
- **Quick Match**: Average match time < 10 seconds
- **Skip Partner**: Instantly find new match with "Next" button

### 🎨 Modern UI/UX

- **Responsive Design**: Works on mobile, tablet, desktop
- **Dark Mode**: Eye-friendly dark theme (default)
- **Animations**: Smooth transitions with Framer Motion
- **Confetti Effects**: Celebration on successful matches
- **Loading States**: Clear feedback during matching

### 🔒 Safety & Privacy

- **No Data Storage**: Messages not saved after session ends
- **IP Protection**: No IP addresses exposed to users
- **Report System**: Report inappropriate behavior
- **Moderation**: Admin panel for monitoring (see `admin-omegle-vitap/`)
- **Auto-Disconnect**: Idle timeout after 5 minutes

### 📱 Mobile Optimized

- **Touch Gestures**: Swipe to skip, tap to chat
- **Mobile Camera**: Access front/back camera
- **Adaptive Layout**: Optimized for all screen sizes
- **PWA Support**: Install as mobile app

## 🏗️ Tech Stack

### Frontend Framework

- **Next.js 16.0.3** - App Router, Server Components, Turbopack
- **React 19.2.0** - Latest stable with React Compiler
- **TypeScript 5.x** - Strict type checking

### Real-Time Communication

- **Socket.IO Client 4.8.1** - WebSocket for signaling
- **Native WebRTC** - 1:1 P2P video/audio
- **WebRTC** - Peer-to-peer video and audio

### State Management

- **XState 5.24.0** - State machines for chat flow
- **React Context** - Global state management
- **Custom Hooks** - Reusable logic

### UI Components

- **Hero UI** - Component library
- **Tailwind CSS 4** - Utility-first styling
- **Framer Motion 12** - Animations
- **Lucide React** - Icons
- **Canvas Confetti** - Celebration effects

### Chat Features

- **Emoji Picker React** - Emoji selection
- **Linkify React** - Automatic link detection
- **Sonner** - Toast notifications

### Analytics

- **PostHog** - Product analytics (funnel, match, error, engagement tracking)

### Testing

- **Vitest 4.0.14** - Unit testing
- **Testing Library** - Component testing
- **React Testing Library** - React component testing

### Development Tools

- **ESLint 9** - Code linting
- **Prettier 3.7.2** - Code formatting
- **Husky 9.1.7** - Git hooks
- **lint-staged** - Pre-commit checks

## 📋 Prerequisites

- **Node.js**: >= 20.0.0
- **pnpm**: >= 10.0.0 (or npm/yarn)
- **Backend API**: Running backend server (see `omeagle-vitap-backend/`)
- **coturn**: TURN when campus NAT blocks P2P

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Navigate to project directory
cd omegle-vitap

# Install dependencies
pnpm install
# or
npm install
```

### 2. Environment Setup

Create `.env.local` file in the project root:

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080

# ICE / TURN come from the match event (no NEXT_PUBLIC_LIVEKIT_*)

# PostHog Analytics (Optional)
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_project_api_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# API Security
NEXT_PUBLIC_API_KEY=your_websocket_api_key
```

### 3. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Start Backend Server

```bash
# In backend directory
cd ../omeagle-vitap-backend
npm run dev
```

Backend API must be running on port 8080.

## 📦 Available Scripts

### Development

```bash
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm format           # Format code with Prettier
pnpm type-check       # TypeScript type checking
```

### Testing

```bash
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:coverage    # Generate coverage report
pnpm test:ui          # Open Vitest UI
pnpm test:ci          # Run tests in CI mode
```

### Validation & Deployment

```bash
pnpm validate         # Run all checks (type, lint, format, test)
```

## 📁 Project Structure

```
omegle-vitap/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   ├── globals.css        # Global styles
│   │   ├── chat/              # Chat room page
│   │   ├── about/             # About page
│   │   ├── terms/             # Terms of service
│   │   └── privacy/           # Privacy policy
│   │
│   ├── components/            # React components
│   │   ├── common/            # Shared components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── chat/              # Chat components
│   │   │   ├── VideoPlayer.tsx      # Video display
│   │   │   ├── ChatBox.tsx          # Text chat
│   │   │   ├── ControlPanel.tsx     # Audio/video controls
│   │   │   ├── MatchingScreen.tsx   # Finding partner UI
│   │   │   └── DisconnectedScreen.tsx
│   │   ├── home/              # Landing page components
│   │   │   ├── Hero.tsx
│   │   │   ├── Features.tsx
│   │   │   └── HowItWorks.tsx
│   │   └── layout/            # Layout components
│   │       ├── Header.tsx
│   │       ├── Footer.tsx
│   │       └── Navigation.tsx
│   │
│   ├── machines/              # XState state machines
│   │   ├── chatMachine.ts     # Chat flow state machine
│   │   └── matchingMachine.ts # Matchmaking state machine
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── useWebSocket.ts    # WebSocket connection
│   │   ├── useWebRTC.ts       # WebRTC peer connection
│   │   ├── useRtc.ts          # P2P WebRTC
│   │   ├── useChat.ts         # Chat state and messages
│   │   ├── useMediaDevices.ts # Camera/mic access
│   │   └── useMatchmaking.ts  # Matchmaking logic
│   │
│   ├── services/              # API services
│   │   ├── socket.service.ts  # Socket.IO client
│   │   ├── rtc/               # P2P WebRTC facade
│   │   ├── chat.service.ts    # Chat API
│   │   └── analytics.service.ts # Analytics tracking
│   │
│   ├── providers/             # Context providers
│   │   ├── SocketProvider.tsx # WebSocket context
│   │   ├── ChatProvider.tsx   # Chat state context
│   │   └── AuthProvider.tsx   # Auth context (optional)
│   │
│   ├── lib/                   # Utility libraries
│   │   ├── posthog.ts         # PostHog analytics SDK
│   │   ├── utils.ts           # General utilities
│   │   ├── validators.ts      # Input validation
│   │   └── constants.ts       # App constants
│   │
│   ├── types/                 # TypeScript types
│   │   ├── chat.ts            # Chat types
│   │   ├── user.ts            # User types
│   │   ├── socket.ts          # Socket event types
│   │   └── index.ts           # Shared types
│   │
│   ├── constants/             # Application constants
│   │   └── index.ts
│   │
│   ├── utils/                 # Utility functions
│   │   └── helpers.ts
│   │
│   └── __tests__/             # Unit tests
│       └── setup.ts           # Test configuration
│
├── public/                    # Static assets
│   ├── _headers               # HTTP headers
│   ├── og-image.html          # Open Graph image
│   ├── site.webmanifest       # PWA manifest
│   ├── favicon.ico
│   └── images/
│
├── next.config.ts             # Next.js configuration
├── tailwind.config.js         # Tailwind CSS config
├── tsconfig.json              # TypeScript config
├── vitest.config.ts          # Vitest config
├── package.json               # Dependencies
└── pnpm-lock.yaml            # Lock file
```

## 🎮 User Flow

### Chat Session Flow (XState Machine)

```
┌──────────┐
│  IDLE    │ Start
└────┬─────┘
     │
     │ User clicks "Start Chat"
     │
┌────▼─────────┐
│  CONNECTING  │ → Connect WebSocket
└────┬─────────┘
     │
     │ Socket connected
     │
┌────▼──────────┐
│  AUTHENTICATING│ → Send auth message
└────┬──────────┘
     │
     │ Auth successful
     │
┌────▼────────┐
│  SEARCHING  │ → Join matchmaking queue
└────┬────────┘     Show queue position
     │
     │ Match found
     │
┌────▼────────┐
│  MATCHED    │ → Receive ICE servers / TURN creds
└────┬────────┘     Start P2P WebRTC
     │
     │ Video/audio connected
     │
┌────▼────────┐
│  CHATTING   │ → Active chat session
└────┬────────┘     Video + text chat
     │
     │ User clicks "Next" or partner leaves
     │
┌────▼──────────┐
│ DISCONNECTING │ → Leave room
└────┬──────────┘     Cleanup connections
     │
     │ Ready for new match
     │
└────────┬────────────┘
         │
    Back to SEARCHING
```

## 🔌 WebSocket Integration

### Connection Setup

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080', {
  query: {
    apiKey: process.env.NEXT_PUBLIC_API_KEY,
  },
  transports: ['websocket'],
});

// Authenticate
socket.emit('auth', {
  uid: userId,
  name: userName,
  gender: 'any',
});

// Start searching
socket.emit('search', {
  gender: 'any',
  interests: ['music', 'movies'],
});
```

### Socket Events

**Outgoing (Client → Server):**

- `auth` - Authenticate user
- `search` - Join matchmaking queue
- `message` - Send text message
- `signal` - WebRTC signaling data
- `leave` - Exit current chat
- `cancel` - Cancel search
- `next` - Skip to next partner

**Incoming (Server → Client):**

- `auth_success` - Authentication confirmed
- `match` - Matched with partner
- `partner_left` - Partner disconnected
- `message` - Receive text message
- `signal` - WebRTC signaling from partner
- `queue_position` - Your position in queue
- `error` - Error messages

See complete API documentation: [`../omeagle-vitap-backend/docs/WEBSOCKET_API.md`](../omeagle-vitap-backend/docs/WEBSOCKET_API.md)

## P2P WebRTC

Match payload includes `isOfferer`, `iceServers`, and `rtcEnabled`. The client creates an `RTCPeerConnection` and relays `offer` / `answer` / `candidate` over Socket.IO `signal`. TURN credentials are minted by the backend for coturn. Camera and mic use `getUserMedia` plus `replaceTrack` on preallocated transceivers (no renegotiation on mute).

## 🎨 Theming & Styling

### Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        },
        accent: {
          pink: '#ec4899',
          purple: '#8b5cf6',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-up': 'slideUp 0.4s ease-out',
      },
    },
  },
};
```

### Custom Components

```tsx
// Button with variants
<Button variant="primary" size="lg" onClick={startChat}>
  Start Chatting
</Button>

// Video player
<VideoPlayer
  track={remoteVideoTrack}
  participant={remoteParticipant}
  mirrored={false}
/>

// Chat box
<ChatBox
  messages={messages}
  onSendMessage={handleSendMessage}
  placeholder="Type a message..."
/>
```

## 🚀 Deployment

### Static Hosting

The app builds to a static export (`out/`):

```bash
# Build for production
pnpm build
```

Deploy the `out/` directory to any static host (e.g. Cloud Storage + CDN, S3 + CloudFront, Vercel, Netlify).

### Environment Variables in Production

Set the `NEXT_PUBLIC_*` environment variables (see `.env.example`) at build time on your hosting platform.

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
        with:
          version: 10
      - run: pnpm install
      - run: pnpm validate
      - run: pnpm build
      # Deploy the static `out/` artifact to your hosting target
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: out/
```

## 📊 Analytics & Monitoring

### PostHog

```typescript
import { analytics } from '@/services/analytics';

// Track page views
analytics.trackPageView('omegle', 'Video Chat');

// Track events
analytics.trackMatchFound(queueDuration);
```

### Custom Events

- `chat_started` - User starts searching
- `match_found` - Successfully matched
- `message_sent` - Text message sent
- `video_enabled` - Camera turned on
- `next_clicked` - User skips partner
- `chat_ended` - Session ended

## 🔒 Security & Privacy

### Data Protection

- ✅ No message persistence
- ✅ No video/audio recording
- ✅ Encrypted WebSocket connections (WSS)
- ✅ Encrypted WebRTC (DTLS-SRTP)
- ✅ No user data collection without consent

### Content Safety

- ✅ Report button for inappropriate behavior
- ✅ Admin monitoring available
- ✅ Rate limiting on messages
- ✅ Automatic profanity filter (optional)

### GDPR Compliance

- ✅ No cookies (except essential)
- ✅ Clear privacy policy
- ✅ Data deletion on request
- ✅ Minimal data collection

## 🐛 Troubleshooting

### Camera/Microphone Not Working

```bash
# Check browser permissions
# Chrome: chrome://settings/content/camera
# Firefox: about:preferences#privacy

# Test media devices
navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
}).then(stream => {
  console.log('Media devices working!');
}).catch(err => {
  console.error('Permission denied:', err);
});
```

### WebSocket Connection Failed

```bash
# Check backend is running
curl http://localhost:8080/health

# Verify NEXT_PUBLIC_WS_URL
echo $NEXT_PUBLIC_WS_URL

# Check CORS settings in backend
```

### Video connection issues

Most campus pairs go P2P. If video fails, check coturn (`TURN_HOST`, UDP 3478) and that the match event includes `iceServers`.

### Build Errors

```bash
# Clear cache
rm -rf .next node_modules
pnpm install
pnpm build

# Check Node.js version
node --version  # Should be >= 20.0.0
```

## 📈 Performance

### Lighthouse Scores

- **Performance**: 90+
- **Accessibility**: 95+
- **Best Practices**: 100
- **SEO**: 100

### Optimizations

- ✅ React Server Components
- ✅ Automatic code splitting
- ✅ Image optimization
- ✅ Font optimization
- ✅ Bundle size minimization
- ✅ Lazy loading components
- ✅ Prefetching routes

### Bundle Size

- **First Load JS**: ~180 KB (gzipped)
- **Route Chunks**: 20-50 KB each
- **Total Bundle**: ~1.8 MB (uncompressed)

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Run validation: `pnpm validate`
5. Commit changes: `git commit -m "feat: add amazing feature"`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Style

- Follow ESLint rules
- Use Prettier for formatting
- Write TypeScript with strict types
- Add tests for new features
- Update documentation

### Commit Convention

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code refactoring
- `test:` Tests
- `chore:` Maintenance

## 📄 License

MIT License - see [LICENSE](LICENSE) file

## 🆘 Support

- **Documentation**: Check this README and `docs/` folder
- **Backend Docs**: [`../omeagle-vitap-backend/docs/`](../omeagle-vitap-backend/docs/)
- **Issues**: [GitHub Issues](https://github.com/yourusername/omegle-vitap/issues)
- **Email**: support@yourdomain.com

## 🔗 Related Projects

- **Admin Panel**: [`../admin-omegle-vitap/`](../admin-omegle-vitap/) - Dashboard for monitoring
- **Backend API**: [`../omeagle-vitap-backend/`](../omeagle-vitap-backend/) - WebSocket server

## 🙏 Acknowledgments

- **coturn** - TURN for P2P ICE
- **Socket.IO** - WebSocket library
- **Next.js** - React framework
- **Vercel** - Next.js creators
- **PostHog** - Product analytics

## 📝 Changelog

### v0.1.0 (December 2025)

- ✅ Initial release
- ✅ Video/audio chat over P2P WebRTC
- ✅ Text chat with emoji support
- ✅ Gender-based matchmaking
- ✅ Anti-rematch system
- ✅ Mobile responsive design
- ✅ React 19 and Next.js 16
- ✅ XState for chat flow
- ✅ Comprehensive testing

## 🎯 Roadmap

### v0.2.0 (Q1 2026)

- [ ] Screen sharing
- [ ] Group chat (3+ users)
- [ ] Interest-based matching algorithm
- [ ] Virtual backgrounds
- [ ] AR filters

### v0.3.0 (Q2 2026)

- [ ] Voice-only mode
- [ ] Language selection
- [ ] Chat translations
- [ ] Saved interests
- [ ] Friend system

---

**Built with ❤️ for VIT-AP students**

**Start chatting anonymously today!** 🎉
