import 'dotenv/config';

// Point every Prisma client created in API tests at the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Fixed test values for auth and encryption (never real secrets).
process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-0123456789';
process.env.BETTER_AUTH_URL = 'http://test';
process.env.BETTER_AUTH_RATE_LIMIT = 'off';
process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.SEED_DEMO_PASSWORD = 'demo-password-for-tests';
