-- Money on transactions keeps satang: integer baht -> NUMERIC(14,2). Existing values convert exactly.
ALTER TABLE "transactions"
  ALTER COLUMN "amount" TYPE DECIMAL(14,2),
  ALTER COLUMN "interest" TYPE DECIMAL(14,2),
  ALTER COLUMN "fee" TYPE DECIMAL(14,2);
