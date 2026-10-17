-- Bills can be flagged as subscriptions (recurring services like streaming), shown and filtered separately.
ALTER TABLE "bills" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'bill';
