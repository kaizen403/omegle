'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Takeover participant UI — opened by admin in a new tab via
 * `admin:takeover:impersonate` -> `takeover_ready` { url: https://vitap.in/takeover?takeover=TOKEN }
 * The token is a short-lived JWT that lets this tab claim the kicked participant's UID
 * and join the live room as a normal participant with full voice (existing VideoDisplay).
 * This page is just a thin wrapper that forwards `?takeover=TOKEN` to the normal Omegle UI;
 * the Socket.IO auth picks it up automatically (socketio.service.ts).
 */
export default function TakeoverPage() {
  const params = useSearchParams();
  const token = params.get('takeover') || params.get('takeoverToken');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (token) {
      // Store for socket reconnects (query stays in URL anyway)
      try {
        sessionStorage.setItem('takeoverToken', token);
      } catch {}
    }
  }, [token]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-xl font-semibold">No takeover token</h1>
          <p className="text-sm text-slate-600">
            Open this page via <span className="font-mono">Moderation → Monitor → Takeover as…</span> in the admin panel. The token is short-lived (2 min).
          </p>
        </div>
      </div>
    );
  }

  // Redirect to the normal participant UI with token preserved — that UI already has voice (VideoDisplay + WebRTC)
  useEffect(() => {
    const url = `/omegle?takeover=${encodeURIComponent(token)}`;
    window.location.replace(url);
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <p className="text-sm text-slate-600">Opening takeover session…</p>
        <p className="font-mono text-xs break-all bg-slate-50 p-2 rounded border">{token.slice(0, 40)}…</p>
        <button
          onClick={() => {
            const url = `${window.location.origin}/omegle?takeover=${encodeURIComponent(token)}`;
            navigator.clipboard.writeText(url).then(() => setCopied(true));
            setTimeout(() => setCopied(false), 2000);
          }}
          className="text-xs px-3 py-1.5 rounded bg-sky-500 text-white"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
