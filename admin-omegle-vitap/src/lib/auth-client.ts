import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/**
 * Better Auth client for the admin panel.
 *
 * Email + password sign-in is provided by the core client (`signIn.email`).
 * The TOTP plugin exposes `twoFactor.verifyTotp` for the MFA step.
 *
 * The session is stored in an httpOnly cookie by the backend; the session
 * token exposed here is only used to authenticate the Socket.IO `/admin`
 * connection.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL,
  plugins: [twoFactorClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export const { signIn, signOut, getSession, useSession, twoFactor } =
  authClient;
