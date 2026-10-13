-- Debt terms, due-date rules and opening balance; payoff labels become derived.
ALTER TABLE "debts"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'personal',
  ADD COLUMN "lender" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "opening_paid" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fixed_payment" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "term_months" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "due_day" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "grace_days" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "late_fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "penalty_apr" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Everything repaid so far predates the ledger.
UPDATE "debts" SET "opening_paid" = "paid";

ALTER TABLE "debts" DROP COLUMN "payoff", DROP COLUMN "payoff_th", DROP COLUMN "months_left";

CREATE TABLE "debt_payments" (
  "id" SERIAL NOT NULL,
  "debt_id" INTEGER NOT NULL,
  "date" DATE NOT NULL,
  "amount" INTEGER NOT NULL,
  "principal" INTEGER NOT NULL,
  "interest" INTEGER NOT NULL,
  "fee" INTEGER NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "debt_payments_debt_id_date_idx" ON "debt_payments"("debt_id", "date");
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey"
  FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "settings" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);
