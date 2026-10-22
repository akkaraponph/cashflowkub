import { execFileSync, execSync, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import 'dotenv/config';

// Brings the test database schema up to date once per run. Data is reset per
// test file by seedDatabase() (TRUNCATE ... RESTART IDENTITY), never by migrate reset.
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('could not select a local backend port');
  const { port } = address;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export default async function setup(): Promise<() => Promise<void>> {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  if (url === process.env.DATABASE_URL) throw new Error('TEST_DATABASE_URL must differ from DATABASE_URL: api tests truncate tables');
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
  execFileSync('cargo', ['build', '--manifest-path', '../backend/Cargo.toml'], { stdio: 'inherit', cwd: process.cwd() });

  const port = await freePort();
  const serviceToken = 'api-test-backend-token';
  const encryptionKey = Buffer.alloc(32, 7).toString('base64');
  const backend = spawn('../backend/target/debug/cashflowkub-backend', [], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      DATABASE_URL: url,
      DATA_ENCRYPTION_KEY: encryptionKey,
      BACKEND_SERVICE_TOKEN: serviceToken,
      BACKEND_BIND_ADDRESS: `127.0.0.1:${port}`,
    },
  });
  let stderr = '';
  backend.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
  process.env.BACKEND_URL = `http://127.0.0.1:${port}`;
  process.env.BACKEND_SERVICE_TOKEN = serviceToken;
  process.env.DATA_ENCRYPTION_KEY = encryptionKey;

  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (backend.exitCode !== null) throw new Error(`Rust backend exited before readiness: ${stderr}`);
    try {
      const response = await fetch(`${process.env.BACKEND_URL}/internal/health`);
      if (response.ok) { ready = true; break; }
    } catch {
      // The listener may not have bound yet.
    }
    await delay(100);
  }
  if (!ready) {
    backend.kill();
    throw new Error(`Rust backend did not become ready: ${stderr}`);
  }
  return async () => {
    if (backend.exitCode === null) {
      backend.kill();
      await new Promise<void>((resolve) => backend.once('exit', () => resolve()));
    }
  };
}
