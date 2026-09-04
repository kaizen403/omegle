process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.API_KEY = process.env.API_KEY || 'test-api-key';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/test';
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'test-better-auth-secret';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

// Security-relevant defaults for the suite. clientIp.ts parses TRUSTED_PROXIES at import
// time, so it must be set before any module loads.
process.env.TRUSTED_PROXIES = process.env.TRUSTED_PROXIES || 'cloudflare,private';
process.env.ALLOWED_ORIGINS =
  process.env.ALLOWED_ORIGINS || 'https://omegle.example.com,*.pages.dev';
process.env.S3_BUCKET = process.env.S3_BUCKET || 'test-bucket';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
process.env.S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || 'https://cdn.example.com';
