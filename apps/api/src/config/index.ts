import dotenv from 'dotenv';

dotenv.config();
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '.env.development' });
}

function parseBool(value: string | undefined): boolean {
  if (!value) return false;
  return value === 'true' || value === '1' || value === 'yes';
}

function parseOrigins(raw: string | undefined, isProduction: boolean): string[] {
  const parsed = (raw || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin && origin !== '*');

  if (parsed.length > 0) {
    return parsed;
  }

  if (isProduction) {
    return [];
  }

  return ['http://localhost:3000', 'http://localhost:3001'];
}

function parseStunUrls(raw: string | undefined): string[] {
  const parsed = (raw || '')
    .split(',')
    .map((url) => url.trim())
    .filter((url) => url.length > 0);

  if (parsed.length > 0) {
    return parsed;
  }

  return ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'];
}

export interface Config {
  port: number;
  nodeEnv: string;
  turnHost: string;
  turnPort: number;
  turnTlsPort: number;
  turnAuthSecret: string;
  turnRealm: string;
  stunUrls: string[];
  allowedOrigins: string[];
  apiKey: string;
  redisHost: string;
  redisPort: number;
  redisTls: boolean;
  databaseUrl: string;
  betterAuthSecret: string;
  betterAuthUrl: string;
  turnstileSecretKey: string;
  awsRegion: string;
  s3Bucket: string;
  s3PublicBaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
  };
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export const config: Config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv,
  turnHost: process.env.TURN_HOST || '',
  turnPort: parseInt(process.env.TURN_PORT || '3478', 10),
  turnTlsPort: parseInt(process.env.TURN_TLS_PORT || '0', 10),
  turnAuthSecret: process.env.TURN_AUTH_SECRET || '',
  turnRealm: process.env.TURN_REALM || 'omegle',
  stunUrls: parseStunUrls(process.env.STUN_URLS),
  allowedOrigins: parseOrigins(process.env.ALLOWED_ORIGINS, isProduction),
  apiKey: process.env.API_KEY || '',
  redisHost: process.env.REDIS_HOST || (isProduction ? '10.122.145.19' : 'localhost'),
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisTls: parseBool(process.env.REDIS_TLS),
  databaseUrl: process.env.DATABASE_URL || '',
  betterAuthSecret: process.env.BETTER_AUTH_SECRET || '',
  betterAuthUrl: process.env.BETTER_AUTH_URL || 'http://localhost:8080',
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY || '',
  awsRegion: process.env.AWS_REGION || '',
  s3Bucket: process.env.S3_BUCKET || '',
  s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
  },
};

const requiredFields = [
  'apiKey',
  'redisHost',
  'jwt.secret',
  'databaseUrl',
  'betterAuthSecret',
];

if (isProduction) {
  requiredFields.push('awsRegion', 's3Bucket', 'turnHost', 'turnAuthSecret');
}

const missingFields: string[] = [];

for (const field of requiredFields) {
  const keys = field.split('.');
  let value: unknown = config;
  for (const key of keys) {
    value = (value as Record<string, unknown>)?.[key];
  }
  if (!value) {
    missingFields.push(field);
  }
}

if (isProduction && config.allowedOrigins.length === 0) {
  missingFields.push('allowedOrigins');
}

if (missingFields.length > 0) {
  console.error('\nERROR: Missing required environment variables:');
  missingFields.forEach((field) => {
    console.error(`   - ${field}`);
  });
  console.error('\nCreate a .env file with the required variables.');
  console.error('   DATABASE_URL=postgresql://... (Neon pooled)');
  console.error('   BETTER_AUTH_SECRET=...');
  console.error('   BETTER_AUTH_URL=http://localhost:8080');
  console.error('   REDIS_HOST=localhost');
  console.error('   REDIS_TLS=false');
  console.error('   TURN_HOST=localhost');
  console.error('   TURN_AUTH_SECRET=...');
  console.error('   AWS_REGION=ap-south-1');
  console.error('   S3_BUCKET=...');
  console.error('   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001\n');
  console.error('Shutting down...\n');

  process.exit(1);
}
