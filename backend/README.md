# CashflowKub Rust backend

This Axum service owns finance API behavior and PostgreSQL access. The Next.js app remains the only public origin: it validates Better Auth sessions, replaces caller identity headers, and forwards requests using the private service token. Bind Rust to a private address and do not publish its port.

## Local startup

1. Deploy the existing Prisma schema to the selected database with `pnpm --dir frontend db:deploy`.
2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL`, `DATA_ENCRYPTION_KEY`, and `BACKEND_SERVICE_TOKEN`; use the same database, encryption key, and service token as the Next.js app. Generate secrets with `openssl rand -base64 32`.
3. Set `BACKEND_URL=http://127.0.0.1:8080` in `frontend/.env` and use the same `BACKEND_SERVICE_TOKEN` in both environment files.
4. From the repository root, run `make dev` to start Rust and Next.js together. Use Ctrl+C to stop both. To run one service independently, use `make backend` or `make frontend`; `cargo run --manifest-path backend/Cargo.toml` also loads `backend/.env` when started directly.
5. Check `GET http://127.0.0.1:8080/internal/health`; the public application remains at `http://localhost:3000`.

### Local test login accounts

Set `SEED_ACCOUNTS_ENABLED=true` and provide `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_CLIENT_EMAIL`, and `SEED_CLIENT_PASSWORD` in `backend/.env`. The email is the sign-in username. Each backend startup creates a missing account or replaces its Better Auth credential password, removes that user's existing sessions, and ensures default categories exist. New seeded users are marked with a stale privacy notice version and must acknowledge the current notice after signing in. Leave startup seeding disabled for any database where resetting these accounts is not intended. The current app has no separate admin role, so the account named Admin has the same permissions as Client.

Prisma migrations remain the only schema deployment history. Do not run `pnpm db:seed` against production: it truncates the database.

## Configuration and deployment

- Rust requires `DATABASE_URL`, `DATA_ENCRYPTION_KEY` (base64 of exactly 32 bytes), and `BACKEND_SERVICE_TOKEN`. `BACKEND_BIND_ADDRESS` defaults to `127.0.0.1:8080`.
- Next.js requires `BACKEND_URL` and the matching `BACKEND_SERVICE_TOKEN`. Keep both server-side; never use a `NEXT_PUBLIC_` prefix.
- Put Rust and PostgreSQL on private networks. Public traffic goes through a TLS-terminating reverse proxy to Next.js. Allow only the Next.js service to connect to Rust.
- Keep PostgreSQL disk encryption enabled, require TLS for remote database connections, encrypt database backups, and store a separate backup of the encryption key.
- Rotate the shared service token in both deployments together. Rotate the data key only with a planned data re-encryption migration; existing ciphertext will not decrypt with a different key.
- Account deletion remains a Better Auth operation in Next.js and relies on PostgreSQL `ON DELETE CASCADE` for finance rows.

## Rollback

Each public Next.js route is a small gateway. To roll back a domain, deploy the previous Next.js handler revision for that domain while keeping the shared database schema in place. Do not roll back Prisma migrations independently of the release compatibility window. Keep Rust available until the rollback window closes.

## Tests

Use a disposable local database whose name ends in `_test` for integration tests. Rust test wrappers validate this before running. `cargo test --manifest-path backend/Cargo.toml` expects `TEST_DATABASE_URL`; API tests use the same test database through the repository's guarded runner.
