/**
 * Maintenance Guard Provider
 *
 * Puts the public site into maintenance at runtime: an operator flips one switch in the
 * admin dashboard and every open tab follows within a poll interval, with no rebuild and
 * no redeploy. The web app is a static export (`output: 'export'`), so there is no server,
 * middleware or server component to ask — the only place this check can live is the client,
 * polling the public `GET /status` endpoint.
 *
 * The current status (including the operator's note) is published through context so the
 * maintenance page can render the message.
 */

'use client';

import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  ALLOWED_MAINTENANCE_PATHS,
  BACKEND_CHECK_TIMEOUT,
  MAINTENANCE_GATE_TIMEOUT,
  MAINTENANCE_POLL_INTERVAL,
  ROUTES,
} from '@/constants';

/**
 * Build-time escape hatch, kept from the env-var implementation. It only ever forces
 * maintenance ON — a `maintenance: false` reply can never switch it back off. This is the
 * lever to pull when the API itself is the thing that is broken, which is precisely when
 * /status cannot be trusted to answer.
 */
const MAINTENANCE_OVERRIDE = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

/** The fields of the public status payload that this guard reads. */
interface StatusResponse {
  maintenance?: boolean;
  message?: string | null;
}

export interface MaintenanceStatus {
  /** True while the public site is paused. */
  maintenance: boolean;
  /** Operator note to show on the maintenance page, or null when there is none. */
  message: string | null;
}

const OPEN: MaintenanceStatus = { maintenance: false, message: null };

/**
 * Defaults to the build-time override so a consumer rendered outside the guard (a test, a
 * page in isolation) still sees a sane value. There is deliberately no "must be used within
 * a provider" throw: the guard sits in the root layout, and a missing status should degrade
 * to "site is up", never to a crash.
 */
export const MaintenanceContext = createContext<MaintenanceStatus>({
  maintenance: MAINTENANCE_OVERRIDE,
  message: null,
});

/** `trailingSlash: true` means usePathname can hand back `/maintenance/`. */
function normalizePath(pathname: string | null): string {
  if (!pathname) return '/';
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_MAINTENANCE_PATHS.some((allowed) => pathname.startsWith(allowed));
}

/**
 * Neutral stand-in, shown while the first status check is in flight and while the router is
 * navigating to /maintenance. It is the site's own background, so it reads as "page still
 * loading" rather than as a broken screen.
 */
function LoadingGate() {
  return (
    <div className="bg-sky bg-bubbles min-h-screen" role="status" aria-busy="true">
      <span className="sr-only">Checking service status</span>
    </div>
  );
}

interface MaintenanceGuardProps {
  children: ReactNode;
}

export function MaintenanceGuard({ children }: MaintenanceGuardProps) {
  const pathname = normalizePath(usePathname());
  const router = useRouter();
  const allowed = isAllowedPath(pathname);

  /** Last answer from /status. The override is applied on top, never stored here. */
  const [remote, setRemote] = useState<MaintenanceStatus>(OPEN);
  /** False until the first check settles, or until the gate times out and we fail open. */
  const [settled, setSettled] = useState(MAINTENANCE_OVERRIDE);

  const maintenance = MAINTENANCE_OVERRIDE || remote.maintenance;

  // Poll /status: on mount, on an interval, when the tab comes back to the foreground, and
  // when the browser regains connectivity. The last two matter because a laptop that slept
  // through a maintenance window would otherwise sit on stale state until the next tick.
  useEffect(() => {
    let active = true;
    let inFlight = false;

    // Only re-render when something actually changed, so a 15s poll of an unchanging
    // endpoint does not re-render the whole app tree every tick.
    const apply = (next: MaintenanceStatus) => {
      setRemote((prev) =>
        prev.maintenance === next.maintenance && prev.message === next.message ? prev : next
      );
    };

    const check = async () => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

      // No backend configured (local dev without an API, preview builds): stay open.
      if (!backendUrl) {
        if (active) setSettled(true);
        return;
      }

      // A hidden tab cannot show anything anyway; the visibilitychange listener below
      // re-checks the moment it comes back, so skipping saves pointless requests.
      if (inFlight || document.visibilityState === 'hidden') return;
      inFlight = true;

      try {
        const res = await fetch(`${backendUrl}/status`, {
          // The endpoint is cached server-side; skip the browser cache so a flipped switch
          // is not masked by a stale 200 sitting in the HTTP cache.
          cache: 'no-store',
          signal: AbortSignal.timeout(BACKEND_CHECK_TIMEOUT),
        });
        if (!res.ok) throw new Error(`Status check failed: ${res.status}`);

        const data = (await res.json()) as StatusResponse;
        if (!active) return;

        const message =
          typeof data.message === 'string' && data.message.trim() ? data.message : null;
        apply({ maintenance: data.maintenance === true, message });
      } catch {
        // Fail open, always. A network blip, a CORS hiccup, a cold-starting API or an
        // adblocker eating the request must never strand every visitor on the maintenance
        // page: showing the real app for a few seconds too long is a much cheaper mistake
        // than a self-inflicted outage nobody can clear without a redeploy. The build-time
        // override stays available for the case where the API is genuinely gone.
        if (!active) return;
        apply(OPEN);
      } finally {
        inFlight = false;
        if (active) setSettled(true);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const handleOnline = () => {
      void check();
    };

    void check();
    const interval = setInterval(() => void check(), MAINTENANCE_POLL_INTERVAL);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      active = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Fail-open cap on the first check. Without it a slow or unreachable API would hold the
  // gate (and the whole site) blank for as long as it stayed slow.
  useEffect(() => {
    if (settled) return;
    const timer = setTimeout(() => setSettled(true), MAINTENANCE_GATE_TIMEOUT);
    return () => clearTimeout(timer);
  }, [settled]);

  // Redirects only run once the first answer is in, so nobody gets bounced off /maintenance
  // on the strength of the optimistic default.
  useEffect(() => {
    if (!settled) return;

    if (maintenance && !allowed) {
      router.replace(ROUTES.MAINTENANCE);
      return;
    }

    if (!maintenance && pathname === ROUTES.MAINTENANCE) {
      router.replace(ROUTES.WELCOME);
    }
  }, [settled, maintenance, allowed, pathname, router]);

  const value = useMemo<MaintenanceStatus>(
    () => ({ maintenance, message: remote.message }),
    [maintenance, remote.message]
  );

  /*
   * Flash-of-app tradeoff.
   *
   * App routes render the neutral gate until the first check settles, so the real app never
   * paints during maintenance — not even before hydration, because the gate is what the
   * static export bakes into those routes' HTML. The gate releases itself after
   * MAINTENANCE_GATE_TIMEOUT even if /status has not answered, so a slow API costs a short
   * delay rather than a blank site.
   *
   * The allowed paths (legal pages, FAQ and /maintenance itself) skip the gate entirely.
   * They are the content crawlers read and the pages that must work when the app's JS does
   * not, so their prerendered markup has to stay in the exported HTML.
   */
  const gated = !allowed && (!settled || maintenance);

  return (
    <MaintenanceContext.Provider value={value}>
      {gated ? <LoadingGate /> : children}
    </MaintenanceContext.Provider>
  );
}
