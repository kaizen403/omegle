import { IncomingHttpHeaders } from 'http';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from './auth';

export interface AuthAdmin {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'super-admin';
  photoURL?: string;
  isActive: boolean;
  twoFactorEnabled: boolean;
}

/** Any signed-in admin has full console access. Leftover `super-admin` rows stay valid. */
export function isFullAdmin(role: string | undefined | null): boolean {
  return role === 'admin' || role === 'super-admin';
}

function toAuthAdmin(session: { user: Record<string, unknown> }): AuthAdmin | null {
  const user = session.user;
  if (user.isActive === false) {
    return null;
  }

  return {
    uid: String(user.id),
    email: String(user.email),
    name: String(user.name || ''),
    role: user.role === 'super-admin' ? 'super-admin' : 'admin',
    photoURL: typeof user.image === 'string' ? user.image : undefined,
    isActive: true,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
  };
}

export async function getAdminFromHeaders(
  nodeHeaders: IncomingHttpHeaders
): Promise<AuthAdmin | null> {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(nodeHeaders),
  });

  if (!session?.user) {
    return null;
  }

  return toAuthAdmin(session);
}

export async function getAdminFromToken(
  token?: string | null,
  cookieHeader?: string | string[]
): Promise<AuthAdmin | null> {
  const headers = new Headers();

  if (cookieHeader) {
    headers.set('cookie', Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader);
  }

  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  if (!headers.has('cookie') && !headers.has('authorization')) {
    return null;
  }

  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    return null;
  }

  return toAuthAdmin(session);
}
