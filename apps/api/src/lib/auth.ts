import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, captcha } from 'better-auth/plugins';
import { config } from '../config';
import { db } from '../db';
import * as schema from '../db/schema';

export const auth = betterAuth({
  appName: 'Omegle VITAP Admin',
  baseURL: config.betterAuthUrl,
  secret: config.betterAuthSecret,
  trustedOrigins: config.allowedOrigins,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: true,
        defaultValue: 'admin',
        input: false,
        returned: true,
      },
      isActive: {
        type: 'boolean',
        required: true,
        defaultValue: true,
        input: false,
        returned: true,
      },
      lastLogin: {
        type: 'date',
        required: false,
        input: false,
        returned: true,
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,
    },
  },
  advanced: {
    useSecureCookies: config.nodeEnv === 'production',
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      secure: config.nodeEnv === 'production',
      path: '/',
    },
  },
  plugins: [
    bearer(),
    // TOTP removed at the owner's request: admin sign-in is email + password only.
    // The password is therefore the sole factor guarding a dashboard that can read live
    // private conversations and kick users, so it should be long, unique, and not reused.
    // Turnstile below still fronts sign-in, and /api/auth/* is rate limited.
    // To restore: re-add `twoFactor({ issuer: 'Omegle VITAP Admin' })` here and the
    // enrollment/verification flow in apps/admin (AuthProvider + app/page.tsx).
    ...(config.turnstileSecretKey
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: config.turnstileSecretKey,
            endpoints: ['/sign-in/email'],
          }),
        ]
      : []),
  ],
});

if (config.nodeEnv === 'production' && !config.turnstileSecretKey) {
  console.warn('TURNSTILE_SECRET_KEY is not set; sign-in captcha is disabled');
}

export type Auth = typeof auth;
