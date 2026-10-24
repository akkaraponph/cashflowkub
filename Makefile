.PHONY: dev backend frontend

# Start the private Rust service and the Next.js app together.
dev:
	@set -eu; \
	if [ ! -f backend/.env ]; then \
		echo "Missing backend/.env. Copy backend/.env.example to backend/.env and configure it first." >&2; \
		exit 1; \
	fi; \
	for name in DATABASE_URL DATA_ENCRYPTION_KEY BACKEND_SERVICE_TOKEN; do \
		if ! grep -Eq "^$$name=.+$$" backend/.env; then \
			echo "Set $$name in backend/.env before running make dev." >&2; exit 1; \
		fi; \
	done; \
	for name in BETTER_AUTH_SECRET BETTER_AUTH_URL BACKEND_URL; do \
		if ! grep -Eq "^$$name=.+$$" frontend/.env; then \
			echo "Set $$name in frontend/.env before running make dev." >&2; exit 1; \
		fi; \
	done; \
	set -a; . backend/.env; set +a; \
	cargo build --manifest-path backend/Cargo.toml; \
	./backend/target/debug/cashflowkub-backend & backend_pid=$$!; \
	trap 'kill "$$backend_pid" 2>/dev/null || true; wait "$$backend_pid" 2>/dev/null || true' EXIT INT TERM; \
	pnpm --dir frontend dev

backend:
	@set -eu; \
	if [ ! -f backend/.env ]; then echo "Missing backend/.env; copy backend/.env.example and configure it first." >&2; exit 1; fi; \
	set -a; . backend/.env; set +a; cargo run --manifest-path backend/Cargo.toml

frontend:
	pnpm --dir frontend dev
