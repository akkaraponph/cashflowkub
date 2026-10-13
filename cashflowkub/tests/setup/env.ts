import 'dotenv/config';

// Point every Prisma client created in API tests at the test database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
