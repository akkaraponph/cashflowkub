# Authentication, tenancy, encryption and PDPA

Everything here was added by the `feat/auth-pdpa` branch. The decisions (D1-D8) are in `docs/superpowers/plans/2026-10-19-auth-encryption-pdpa.md`.

## 1. Users and sign-in

- **Better Auth** (`better-auth`, pinned) with email + password and database sessions. No social login, no email verification, no password reset (see section 10).
- Minimum password length is 10. Sign-in and sign-up are rate limited (in memory; `BETTER_AUTH_RATE_LIMIT=off` disables it and is for tests only).
- Better Auth owns four tables, mapped to snake_case names: `users`, `sessions`, `auth_accounts`, `verifications`. The credential row's password is a one-way hash.
- The Rust startup test-account seed is disabled by default and only runs when `SEED_ACCOUNTS_ENABLED=true`. It uses Better Auth-compatible scrypt hashes, resets configured seed account passwords on every startup, and deletes those users' sessions. New seeded users must still acknowledge the current privacy notice. Do not enable it for a database where password resets are not intended. The app has no admin role; the `SEED_ADMIN_*` account is a normal user account.
- **Field-name exception.** Better Auth's extra user fields are camelCase in its API and in the Prisma model: `privacyVersion` and `privacyAcceptedAt` (columns `privacy_version`, `privacy_accepted_at`). Sign-up is `POST /api/auth/sign-up/email` with `privacyVersion` in the body, not `privacy_version`. Everything else we added (`/api/v1/me/*`) is snake_case as AGENTS.md requires.
- Sign-up must send `privacyVersion` equal to `PRIVACY_VERSION` (`src/lib/privacy.ts`, currently `2026-10-19`); otherwise 400. The server stamps `privacyAcceptedAt`.
- `privacyVersion` / `privacyAcceptedAt` cannot be changed through `/api/auth/update-user` (a `databaseHooks.user.update.before` rejects it); only `POST /api/v1/me/privacy` (plain Prisma) changes them.
- **Sign-up and default data are not atomic.** The user row is committed first and the default categories are created in an after-hook (`defaultDataFor`) through the private Rust service. If that call fails, the account exists with no categories. The Rust operation is idempotent and the `(app)` layout retries it whenever the signed-in user has zero categories.
- **Privacy version changes.** When `PRIVACY_VERSION` is bumped, the `(app)` layout redirects every user whose `privacyVersion` differs to `/privacy-update`, which posts `{ privacy_version }` to `POST /api/v1/me/privacy` and returns to `/`.

## 2. Tenancy: `user_id` on every owned table

- Every one of the 20 app tables has `user_id TEXT NOT NULL` with a foreign key to `users(id)` **ON DELETE CASCADE**. The list is `OWNED_MODELS` in `src/server/tenancy.ts`; a unit test derives it from `schema.prisma`, so a new model cannot be forgotten.
- Services do not pass `userId`. `src/lib/db.ts` exports two clients:
  - `prisma`: the **scoped** client (Prisma extension). Every query and write on an owned model gets `userId` added from the current scope, including compound-key lookups (`billId_month`, `userId_key`) and `createMany`. A different `data.userId` on update is rejected.
  - `basePrisma`: the raw client. Used by Better Auth's adapter, the seed, the claim script and tests.
- The legacy Next.js service scope is an `AsyncLocalStorage` in `src/lib/user-context.ts`. Finance APIs and server-rendered finance reads now go through the Rust backend, which receives the verified user ID from the session gateway and scopes every query itself. Better Auth and the privacy acknowledgement remain in Next.js.
- **Fail closed.** An owned-model query with no scope throws; it never returns unscoped rows. Another user's id gives 404, never 403 and never the row.
- **Running code as system.** Seeds, migrations-style scripts and the claim script must say so explicitly: `runAsSystem(async () => { ... })`. In system scope the extension does not add `userId`, and `requireUserId()` throws. Use it with `basePrisma` and write `userId` yourself. Never use it in a request path.
- Uniqueness (account names, category keys, ...) is per user.
- Public routes use `publicRoute()` (no auth): `/login`, `/signup`, `/privacy`, `/api/auth/*`, `/api/health`. Everything else, page or API, needs a session.

## 3. Encryption

- In transit: TLS (deployment requirement). At rest: the database host's disk encryption (deployment requirement). Application level: **AES-256-GCM** on four free-text columns that are never filtered or summed in SQL:
  `Transaction.name`, `Transaction.note`, `DebtPayment.note`, `Debt.lender` (`ENCRYPTED_FIELDS` in `src/server/crypto/fields.ts`).
  Amounts, dates, and item / account / category names stay plaintext because reports match and sum on them.
- Stored value: `enc:v1:<iv>:<tag>:<ciphertext>` (base64url, 12-byte random IV, 16-byte tag, fixed tag length). Empty string stays empty.
- Key: `DATA_ENCRYPTION_KEY`, base64 of exactly 32 bytes (`openssl rand -base64 32`). There is no fallback: a missing or wrong-length key makes every write throw instead of storing plaintext. A tampered value fails to read with an error.
- Rust encrypts on write and decrypts on read using the shared `DATA_ENCRYPTION_KEY`; the Next.js gateway never sees or transforms stored finance rows. Only the four columns are touched; a user who types text that starts with `enc:v1:` into any field keeps it as typed. Values without the prefix are treated as legacy plaintext and pass through.
- **Key rotation (not built).** The `v1` prefix exists so a `v2` key can be introduced: reads would accept both, re-encrypt `v1` values under `v2` on read or in a batch, then retire the old key. Until that exists, losing or changing `DATA_ENCRYPTION_KEY` makes the encrypted columns unreadable. Back the key up separately from the database.
- Do not add `where`, `orderBy`, `contains` or `groupBy` on these columns. Search by name does not work on encrypted text.

## 4. Export and deletion

- **Export** (PDPA s.30-31): `GET /api/v1/me/export` is proxied to Rust and returns one JSON file (`Content-Disposition: attachment`, `cashflowkub-export-YYYY-MM-DD.json`) with `format`, `version`, `exported_at`, `privacy`, `user` and `data` (one array per owned table, snake_case table names, existing model field names retained, `userId` dropped, encrypted fields decrypted). Contains no password hash or session. The settings page links to it.
- **Deletion** (PDPA s.33): `POST /api/auth/delete-user` with `{ password }` hard-deletes the user; the cascade removes every owned row and the sessions. The UI asks for the password and the typed word `DELETE` (`ลบบัญชี` in Thai). The password is **always required**: Better Auth alone would skip the check for a session fresher than a day when no password is sent, so a `hooks.before` in `src/server/auth/auth.ts` returns 400 `password_required` for a missing or empty password (do not set `session.freshAge` to 0, that also skips the check). Other signed-in sessions of that user stop working at once; other users are untouched. No grace period and no soft delete. Backups still hold the data until they expire; state that retention in the privacy notice.

## 5. The privacy page

`/privacy` (en / th) is public. **It is a DRAFT written by the developers. It needs review by someone qualified in Thai law before real users sign up.** The page reads two env vars and throws if either is unset: `PRIVACY_CONTROLLER_NAME` (the data controller's legal name) and `PRIVACY_CONTACT_EMAIL` (where PDPA requests go). Bump `PRIVACY_VERSION` whenever the text changes; every user is then asked to confirm again (section 1).

## 6. PDPA record of processing

Lawful basis is **contract** (PDPA s.24(3)), not consent: the data is needed to provide the service. Sign-up records that the user acknowledged a notice version. No marketing, no analytics, no third-party cookies. Financial data is not "sensitive data" under s.26.

| Data category | Purpose | Lawful basis | Retention | Stored in |
| --- | --- | --- | --- | --- |
| Name, email | Identify the account, sign in | Contract (s.24(3)) | Until the user deletes the account | `users` |
| Password | Authenticate | Contract | Until deletion; one-way hash only | `auth_accounts.password` |
| Session token, IP address, user agent | Keep the user signed in; abuse limiting | Contract; legitimate interest for abuse limiting | Until sign-out, expiry or deletion | `sessions` |
| Privacy notice version and time | Evidence of acknowledgement | Legal obligation / contract | Until deletion | `users.privacy_version`, `privacy_accepted_at` |
| Accounts, balances, budgets, goals, assets, net worth, plan, tax inputs | Show the user their own cashflow | Contract | Until deletion | The 20 owned tables, plaintext |
| Transaction names and notes, debt payment notes, lender names | Same | Contract | Until deletion | `transactions`, `debt_payments`, `debts`, AES-256-GCM |
| Language and year preferences, theme | Remember UI choices | Strictly necessary | Browser cookie lifetime | Cookies `cfk-lang`, `cfk-year`; theme in the browser's local storage |
| Database backups | Recovery | Contract / legitimate interest | Stated in the privacy notice (owner to set) | Host's backup storage, encrypted |

## 7. Breach runbook

1. **Contain.** Revoke the cause (rotate `BETTER_AUTH_SECRET` to end all sessions, rotate database credentials, patch). Keep logs; do not delete evidence.
2. **Assess.** What data, which users, since when, was it readable (plaintext columns) or only ciphertext (the four encrypted columns without the key), was the key exposed. Decide whether there is a **risk to the rights and freedoms of the people**.
3. **Notify the PDPC within 72 hours** of becoming aware, when there is such a risk (PDPA s.37(4)). Say what happened, the data and number of people affected, the likely consequences, the measures taken, and the contact point (`PRIVACY_CONTACT_EMAIL`).
4. **Notify the affected users without delay** when the risk is **high** (s.37(4)): what happened, what it means for them, what to do (change the password), and whom to contact.
5. **Keep a breach log** whatever the outcome: date, facts, assessment, decision, notifications sent, remedial action.
6. **Review.** Fix the root cause and update this document.

## 8. Deployment requirements

- Serve over **TLS only** (HTTPS everywhere, HSTS at the proxy); `BETTER_AUTH_URL` is the public `https://` origin, so cookies are `Secure`.
- Set all env vars (section 9). The app throws at start when `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` or `DATA_ENCRYPTION_KEY` is missing. None has a default.
- PostgreSQL on a host with **disk encryption on**, connections with `sslmode=require` in `DATABASE_URL`.
- **Backups encrypted**, and the backup retention period written into the privacy notice. Keep `DATA_ENCRYPTION_KEY` backed up separately from the database.
- Run `pnpm db:deploy` (never `migrate dev` or `reset` against a real database). Never run `pnpm db:seed` against a real database: it truncates everything, users included.
- **Rate limiting keys on the client IP header.** Deploy behind a trusted proxy that sets it and does not pass a client-supplied `x-forwarded-for` through; otherwise a client can dodge or poison the limit.
- Better Auth's rate limit store is in memory: fine for one instance, not for several (section 10).

### Rust finance backend rollout

The Rust service runs from repository-root `backend/`. Next.js remains the public origin and validates Better Auth sessions before forwarding finance requests with a private `BACKEND_SERVICE_TOKEN` and the verified user ID. The gateway strips incoming identity and authorization headers, keeps `BACKEND_URL` server-only, and returns a generic 502 on upstream connection failure. Rust binds to a private interface and scopes every finance query by `user_id`. Better Auth remains the sole owner of auth tables and sign-in/deletion flows. Reference data, settings, transactions, bills, plans, debts, setup, tax, dashboard, net worth, reports, export, and sign-up default categories use this boundary. See [rust-backend.md](rust-backend.md) for routes and rollout status.

## 9. Environment variables

| Name | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Signs sessions. `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Public origin of the app |
| `DATA_ENCRYPTION_KEY` | base64 of 32 bytes, section 3 |
| `PRIVACY_CONTROLLER_NAME`, `PRIVACY_CONTACT_EMAIL` | Shown on `/privacy`; the page throws without them |
| `SEED_DEMO_PASSWORD` | Password of the seeded `demo@cashflowkub.local` user; no default; seed and tests only |
| `BETTER_AUTH_RATE_LIMIT` | `off` only in tests |

## 10. Existing data and the dev database

The tenancy migration (`20261019010000_tenancy`) adds `user_id` with default `'legacy-owner'` and creates a placeholder user `legacy-owner` (no credential row, nobody can sign in as it), so existing rows survive.

**The dev database in `.env` has NOT been migrated by this branch.** The owner does it once:

1. Add the new env vars to `.env` (section 9), `pnpm db:deploy`.
2. `pnpm dev`, open `/signup` and create the real account.
3. `pnpm db:claim --email <that email>`. It moves every row from `legacy-owner` to that account, encrypts the four free-text columns that were stored as plaintext, replaces the account's default categories/settings that collide with legacy ones, deletes the placeholder, and prints the number of rows moved per model. (Verified against a scratch database: counts print, notes become `enc:v1:...`, the placeholder is gone.)

## 11. Still open (owner decisions, before going public)

- **Password reset and email verification** need an email provider (Resend, Amazon SES, Cloudflare Email). Until then a forgotten password means a lost account; do not open public sign-up before this.
- **Final legal text** of `/privacy`, with the controller's real identity, reviewed by a Thai-law professional.
- **Shared rate-limit store** if more than one instance runs.
- Two-factor login, a session list, "sign out everywhere".
- Whether to retire the Flutter `app/` (it cannot log in against this API).
- Key rotation (section 3) and a stated backup retention.
