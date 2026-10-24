-- Transaction sheet: loan interest/fee and saving goal per row; saving and debt categories.
ALTER TABLE "transactions"
  ADD COLUMN "interest" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "fee" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "goal" TEXT NOT NULL DEFAULT '';

INSERT INTO "categories" ("key", "label", "th", "short", "icon", "tint", "type", "sub", "sort") VALUES
  ('saving', 'Savings & Investing', 'เงินสะสม / การลงทุน', 'Saving', 'piggy-bank', 'xls', 'expense', 'saving', 8),
  ('debt', 'Debt payment', 'ชำระหนี้สิน', 'Debt', 'hand-coins', 'pdf', 'expense', 'debt', 9)
ON CONFLICT ("key") DO NOTHING;
