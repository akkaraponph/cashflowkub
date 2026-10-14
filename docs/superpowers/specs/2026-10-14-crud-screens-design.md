# CRUD screens for the web app — design

Status: **draft for your review** (architectural path: this spec must be approved before `writing-plans`).
Date: 2026-10-14. Branch: `docs/crud-screens-spec`.

## Intent (what I understood, please correct)

The web app can read everything and write four things (add/delete a transaction, tick a bill, record a debt
payment, add a debt). The REST API already supports full create/read/update/delete for every entity, but most
entities have **no screen to create, edit or delete them**. You want those gaps closed so the app is usable
without touching the API by hand.

Success = from the UI you can create, edit and delete: **budgets, accounts, goals, assets, bills, debts
(edit/delete; add exists) and transactions (edit; add/delete exist)**, in EN and TH, with the same look and
feel as the existing dialogs, and every write path covered by a test.

Assumptions (not from you, flag any that are wrong):
- Single user, localhost, no auth (see README "Security").
- Categories, channels and income-categories are *reference data*; managing them is phase 2.
- Plan items already have an API but a full plan editor is out of scope here.

## Current state (verified in the code)

| Entity | API | UI today |
|---|---|---|
| transactions | full CRUD | add (header dialog), delete (detail page); **no edit** |
| bills | full CRUD + pay toggle | tick paid only; **no add/edit/delete** |
| debts | full CRUD + payments ledger | add dialog, record/delete payment; **no edit/delete debt** |
| budgets, accounts, goals, assets | generic CRUD (`/api/v1/<resource>`) | read-only pages |
| categories, channels, income-categories | generic CRUD | none (read-only, used in selects) |

Validation already lives server-side in zod (`src/server/reference/resources.ts`, bill/debt/transaction
services). The UI must not duplicate rules beyond cheap pre-checks; the server stays the authority and the UI
surfaces its 400 messages as toasts (the pattern used by every existing client component).

## Approaches

1. **One bespoke dialog per entity** (like `add-debt-dialog.tsx`). Most flexible, but ~7 near-identical 150-line
   components and 7 copies of the submit/toast/refresh/confirm logic.
2. **Config-driven generic `EntityDialog` for the four plain reference entities** (budgets, accounts, goals,
   assets) driven by a small per-entity field list, plus **bespoke dialogs only where the entity has real
   logic** (bills, debts, transactions). *Recommended.* The generic part is ~1 component + 4 short configs;
   bespoke code is limited to where behaviour differs (e.g. debt terms, bill due day).
3. Generate forms from the zod schemas. Clever, but zod 4 introspection is awkward, labels/i18n/icon pickers
   need hand configuration anyway, and it couples UI to server schema internals. Rejected (YAGNI).

## Design (approach 2)

- **`src/components/crud/entity-dialog.tsx`** (client): props `{ resource, fields, initial?, onDone }`.
  `fields` is a typed list `{ key, labelKey, kind: 'text'|'int'|'money'|'select'|'icon', options?, required? }`.
  It owns: local form state, `apiFetch` POST (create) or PATCH (edit), `toast.error` on failure,
  `router.refresh()` on success. No business rules.
- **`src/components/crud/entity-fields.ts`**: the field lists for budgets, accounts, goals, assets, each
  referencing i18n keys (EN + TH added to `src/lib/i18n.ts`; the existing key-parity test enforces both).
- **`src/components/crud/delete-button.tsx`**: generic confirm-then-DELETE (same `window.confirm` pattern as
  `DeleteTransactionButton`, which it replaces).
- **Screens**: each list page gains an "Add" button and per-row edit/delete (row menu or detail sheet):
  budgets, accounts, goals, net worth (assets). Server components stay server components; only the dialogs
  and buttons are `'use client'`.
- **Bespoke**: `bills/bill-dialog.tsx` (name, amount, due day 1–31, category, account, note);
  `debts/[id]/edit-debt-dialog.tsx` (reuse the add-debt form with `initial`; recomputation of paid/done stays
  server-side under the existing row lock; the server already rejects lowering `original` below the repaid
  amount); `transactions/[id]/edit` via the existing add-transaction dialog with `initial`.
- **Debt delete**: confirm text states that its payment history is deleted too (the API cascades).
- **Referential safety**: deleting an account, category or budget that is referenced elsewhere must not 500.
  Phase 1 decision: show the server's error as a toast and add a service-level guard returning 409 with a
  readable message for categories/accounts still referenced by transactions or bills (currently Prisma's
  foreign-key error would surface as 500 — a known deferred item, P2003).

## Out of scope (YAGNI)

Auth; bulk edit/import/export; drag-to-reorder (`sort` is entered as a number or left default); managing
categories/channels/income-categories (phase 2); undo; a full plan-item editor; optimistic UI.

## Error handling

Server 400/404/409 → toast with the server message; network failure → generic toast; dialogs stay open on
failure so input isn't lost; successful write → close dialog + `router.refresh()`.

## Testing

- Unit: field-config → request-body mapping (ints parsed, empty optionals omitted, TH/EN labels present).
- API: add the missing coverage already noted in the ledger — POST/PATCH for every reference resource,
  404 on missing ids, and 409 (not 500) for referenced-row deletes.
- e2e (existing `E2E_BASE_URL` harness): each new screen renders its Add button in EN and TH.
- Manual browser pass per screen (create → edit → delete → verify list) before each merge.

## Delivery plan (to be turned into a `writing-plans` plan after approval)

1. Generic `EntityDialog` + field configs + delete button + i18n; wire **budgets** end to end (proves the pattern).
2. Accounts, goals, assets (net worth page) on the same pattern.
3. Referential-safety guards (409) + the missing API tests.
4. Bills add/edit/delete.
5. Debt edit/delete and transaction edit.

Each step is independently shippable and gets the same task → spec review → quality review loop as before.

## Decisions I need from you

- Approve this design (or say what to change). Nothing is implemented until you do.
- Confirm phase-2 deferral of categories/channels/income-categories management.
