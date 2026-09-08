/**
 * Lightweight browser fingerprint — runs once per session, sent as `fingerprint:report`.
 * Keep it cheap; accuracy comes from DB correlation of repeated hashes, not from heavy probing.
 */

async function hashString(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 64);
}

function canvasFingerprint(): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 280, 60);
    ctx.fillStyle = '#069';
    ctx.fillText('omegle-vitap 🧬', 4, 18);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText('fingerprint', 4, 38);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}

function webglFingerprint(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : 'unknown';
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
    return `${vendor}~${renderer}`;
  } catch {
    return null;
  }
}

export interface FingerprintReport {
  hash: string;
  canvasHash?: string;
  webglHash?: string;
  audioHash?: string;
  screen?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  vendor?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  plugins?: string[];
  fonts?: string[];
}

export async function collectFingerprint(): Promise<FingerprintReport> {
  const canvasData = canvasFingerprint();
  const webglData = webglFingerprint();
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  const platform = (navigator as any).platform || (navigator as any).userAgentData?.platform || '';
  const vendor = navigator.vendor || '';
  const deviceMemory = (navigator as any).deviceMemory;
  const hardwareConcurrency = navigator.hardwareConcurrency;
  const plugins = Array.from(navigator.plugins || []).map((p) => p.name).slice(0, 20);

  const canvasHash = canvasData ? await hashString(canvasData) : undefined;
  const webglHash = webglData ? await hashString(webglData) : undefined;

  // stable composite
  const composite = [canvasHash || '', webglHash || '', screen, timezone, language, platform, vendor, String(deviceMemory ?? ''), String(hardwareConcurrency ?? '')].join('|');
  const hash = await hashString(composite);

  return {
    hash,
    canvasHash,
    webglHash,
    screen,
    timezone,
    language,
    platform,
    vendor,
    deviceMemory: typeof deviceMemory === 'number' ? deviceMemory : undefined,
    hardwareConcurrency: typeof hardwareConcurrency === 'number' ? hardwareConcurrency : undefined,
    plugins: plugins.length ? plugins : undefined,
  };
}

const LS_KEY = 'omegle_fp_hash';

export function getCachedHash(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export function setCachedHash(hash: string): void {
  try {
    localStorage.setItem(LS_KEY, hash);
  } catch {}
}
