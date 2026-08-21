import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.development' });

import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { db } from '../db';
import { account, user } from '../db/schema';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const name = process.argv[4] || 'Super Admin';
  const role = process.argv[5] === 'admin' ? 'admin' : 'super-admin';

  if (!email || !password) {
    console.error('Usage: npm run seed-admin -- <email> <password> [name] [role]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const existing = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (existing[0]) {
    console.log(`Admin already exists: ${email} (${existing[0].id})`);
    process.exit(0);
  }

  const id = randomUUID();
  const now = new Date();
  await db.insert(user).values({
    id,
    email,
    name,
    role,
    isActive: true,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(account).values({
    id: randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  });

  console.log(`Created ${role}: ${email} (${id})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
