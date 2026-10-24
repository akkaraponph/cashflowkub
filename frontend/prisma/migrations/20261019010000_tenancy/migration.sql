-- Tenancy: every app row belongs to a user.
-- Existing rows are handed to a placeholder user 'legacy-owner' (no auth_accounts row, so
-- nobody can sign in as it); scripts/claim-legacy-data hands them to a real account later.
INSERT INTO "users" ("id", "name", "email", "email_verified", "privacy_version", "privacy_accepted_at", "created_at", "updated_at")
VALUES ('legacy-owner', 'Legacy owner', 'legacy-owner@localhost', false, '2026-10-19', now(), now(), now())
ON CONFLICT ("id") DO NOTHING;

-- DropIndex
DROP INDEX "categories_key_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "debts" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "debt_payments" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "settings" DROP CONSTRAINT "settings_pkey",
ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner',
ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("user_id", "key");

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "bills" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "bill_payments" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "income_categories" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "plan_items" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "asset_snapshots" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "net_worth_histories" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "monthly_cashflows" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "day_spends" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "setup_goals" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- AlterTable
ALTER TABLE "setup_goal_channels" ADD COLUMN     "user_id" TEXT NOT NULL DEFAULT 'legacy-owner';

-- New rows must name their owner: no default from here on.
ALTER TABLE "accounts" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "categories" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "budgets" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "goals" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "debts" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "debt_payments" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "assets" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "bills" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "bill_payments" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "channels" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "income_categories" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "plan_items" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "asset_snapshots" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "net_worth_histories" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "monthly_cashflows" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "day_spends" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "setup_goals" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "setup_goal_channels" ALTER COLUMN "user_id" DROP DEFAULT;
ALTER TABLE "settings" ALTER COLUMN "user_id" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_key_key" ON "categories"("user_id", "key");

-- CreateIndex
CREATE INDEX "transactions_user_id_idx" ON "transactions"("user_id");

-- CreateIndex
CREATE INDEX "budgets_user_id_idx" ON "budgets"("user_id");

-- CreateIndex
CREATE INDEX "goals_user_id_idx" ON "goals"("user_id");

-- CreateIndex
CREATE INDEX "debts_user_id_idx" ON "debts"("user_id");

-- CreateIndex
CREATE INDEX "debt_payments_user_id_idx" ON "debt_payments"("user_id");

-- CreateIndex
CREATE INDEX "settings_user_id_idx" ON "settings"("user_id");

-- CreateIndex
CREATE INDEX "assets_user_id_idx" ON "assets"("user_id");

-- CreateIndex
CREATE INDEX "bills_user_id_idx" ON "bills"("user_id");

-- CreateIndex
CREATE INDEX "bill_payments_user_id_idx" ON "bill_payments"("user_id");

-- CreateIndex
CREATE INDEX "channels_user_id_idx" ON "channels"("user_id");

-- CreateIndex
CREATE INDEX "income_categories_user_id_idx" ON "income_categories"("user_id");

-- CreateIndex
CREATE INDEX "plan_items_user_id_idx" ON "plan_items"("user_id");

-- CreateIndex
CREATE INDEX "asset_snapshots_user_id_idx" ON "asset_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "net_worth_histories_user_id_idx" ON "net_worth_histories"("user_id");

-- CreateIndex
CREATE INDEX "monthly_cashflows_user_id_idx" ON "monthly_cashflows"("user_id");

-- CreateIndex
CREATE INDEX "day_spends_user_id_idx" ON "day_spends"("user_id");

-- CreateIndex
CREATE INDEX "setup_goals_user_id_idx" ON "setup_goals"("user_id");

-- CreateIndex
CREATE INDEX "setup_goal_channels_user_id_idx" ON "setup_goal_channels"("user_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "income_categories" ADD CONSTRAINT "income_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_snapshots" ADD CONSTRAINT "asset_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "net_worth_histories" ADD CONSTRAINT "net_worth_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_cashflows" ADD CONSTRAINT "monthly_cashflows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_spends" ADD CONSTRAINT "day_spends_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_goals" ADD CONSTRAINT "setup_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setup_goal_channels" ADD CONSTRAINT "setup_goal_channels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
