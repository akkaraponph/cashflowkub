-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sub" TEXT NOT NULL DEFAULT '',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT NOT NULL DEFAULT 'landmark',
    "tint" TEXT NOT NULL DEFAULT 'doc',
    "kind" TEXT NOT NULL DEFAULT 'bank',
    "start_date" TEXT NOT NULL DEFAULT '',
    "start_th" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "short" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'circle',
    "tint" TEXT NOT NULL DEFAULT 'doc',
    "type" TEXT NOT NULL DEFAULT 'expense',
    "sub" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "cat_key" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" SERIAL NOT NULL,
    "cat_key" TEXT NOT NULL,
    "spent" INTEGER NOT NULL DEFAULT 0,
    "limit_amt" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'target',
    "saved" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "monthly" INTEGER NOT NULL DEFAULT 0,
    "by" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'credit-card',
    "tint" TEXT NOT NULL DEFAULT 'pdf',
    "original" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL DEFAULT 0,
    "apr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthly" INTEGER NOT NULL DEFAULT 0,
    "calc" TEXT NOT NULL DEFAULT 'reducing',
    "payoff" TEXT NOT NULL DEFAULT '',
    "payoff_th" TEXT NOT NULL DEFAULT '',
    "months_left" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "revolving" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "tint" TEXT NOT NULL DEFAULT 'doc',
    "value" INTEGER NOT NULL DEFAULT 0,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bills" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'receipt',
    "tint" TEXT NOT NULL DEFAULT 'pdf',
    "amount" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "freq" TEXT NOT NULL DEFAULT 'monthly',
    "cat_key" TEXT NOT NULL DEFAULT 'bills',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'saving',
    "icon" TEXT NOT NULL DEFAULT 'piggy-bank',
    "tint" TEXT NOT NULL DEFAULT 'doc',
    "opening" INTEGER NOT NULL DEFAULT 0,
    "start_date" TEXT NOT NULL DEFAULT '',
    "start_th" TEXT NOT NULL DEFAULT '',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "income_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "sub" TEXT NOT NULL DEFAULT 'main',
    "icon" TEXT NOT NULL DEFAULT 'briefcase',
    "tint" TEXT NOT NULL DEFAULT 'xls',
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "income_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '',
    "tint" TEXT NOT NULL DEFAULT '',
    "cat_key" TEXT NOT NULL DEFAULT '',
    "sub" TEXT NOT NULL DEFAULT '',
    "planned" INTEGER NOT NULL DEFAULT 0,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "month" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_snapshots" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "grp" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '',
    "tint" TEXT NOT NULL DEFAULT '',
    "prev" INTEGER NOT NULL DEFAULT 0,
    "curr" INTEGER NOT NULL DEFAULT 0,
    "month" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asset_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "net_worth_histories" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "month_th" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "net_worth_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_cashflows" (
    "id" SERIAL NOT NULL,
    "month" TEXT NOT NULL,
    "income" INTEGER NOT NULL,
    "expense" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "monthly_cashflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_spends" (
    "id" SERIAL NOT NULL,
    "day" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "month" TEXT NOT NULL,

    CONSTRAINT "day_spends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setup_goals" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT 'target',
    "tint" TEXT NOT NULL DEFAULT 'doc',
    "start_date" TEXT NOT NULL DEFAULT '',
    "start_th" TEXT NOT NULL DEFAULT '',
    "end_date" TEXT NOT NULL DEFAULT '',
    "end_th" TEXT NOT NULL DEFAULT '',
    "inflation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL DEFAULT 0,
    "opening" INTEGER NOT NULL DEFAULT 0,
    "current_age" INTEGER,
    "retire_age" INTEGER,
    "use_until_age" INTEGER,
    "monthly_need" INTEGER,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "setup_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setup_goal_channels" (
    "id" SERIAL NOT NULL,
    "setup_goal_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "th" TEXT NOT NULL DEFAULT '',
    "pct" INTEGER NOT NULL,

    CONSTRAINT "setup_goal_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_key_key" ON "categories"("key");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "plan_items_month_idx" ON "plan_items"("month");

-- AddForeignKey
ALTER TABLE "setup_goal_channels" ADD CONSTRAINT "setup_goal_channels_setup_goal_id_fkey" FOREIGN KEY ("setup_goal_id") REFERENCES "setup_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

