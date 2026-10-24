-- Transaction activity (receive | pay | save | pay_debt | withdraw | transfer) and the item it applies to.
ALTER TABLE "transactions"
  ADD COLUMN "activity" TEXT NOT NULL DEFAULT 'pay',
  ADD COLUMN "item" TEXT NOT NULL DEFAULT '';

UPDATE "transactions" SET "activity" = 'receive' WHERE "amount" > 0;

UPDATE "transactions" t SET "activity" = 'save'
  FROM "categories" c WHERE c."key" = t."cat_key" AND c."sub" = 'saving' AND t."amount" < 0;

UPDATE "transactions" t SET "activity" = 'pay_debt'
  FROM "categories" c WHERE c."key" = t."cat_key" AND c."sub" = 'debt' AND t."amount" < 0;

CREATE INDEX "transactions_activity_item_idx" ON "transactions"("activity", "item");
