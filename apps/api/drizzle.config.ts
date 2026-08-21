import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '.env.development' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
