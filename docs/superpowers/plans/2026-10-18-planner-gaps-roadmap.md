# Spreadsheet-planner gaps: roadmap

Source: `docs/knowledge/spreadsheet-planner.md` (§14 "Behaviour to check") plus a read of the code on 2026-10-18.
Each phase gets its own implementation plan in `docs/superpowers/plans/`, written when the previous phase is merged.
Phase 1 is written: [`2026-10-18-transaction-activities.md`](2026-10-18-transaction-activities.md).

## Why this order

The planner gets every number it shows from the transaction log: balances, plan actuals, goal savings,
debt progress and bill paid-state. CashflowKub cannot do that yet. The reason is not missing screens. It is that a
`Transaction` row only records a category and an account. It cannot say "this was a saving into channel X",
"a payment on debt Y", "income from salary" or "a transfer from A to B". So every derived number has to be built
on top of that record, and Phase 1 comes first.

## Phases

| # | Phase | What becomes true | Depends on |
| --- | --- | --- | --- |
| 1 | **Transaction activities** | Every transaction has one of the planner's six activities (รับเงิน, จ่ายเงิน, สะสมเงิน, ชำระหนี้, เบิกเงิน, เปลี่ยนบัญชี) and the **item** it applies to: income item, savings channel, debt or source account. Rows with no account or item are rejected. Renaming an item renames it everywhere it is used, and an item still in use can't be deleted. | — |
| 2 | **Computed balances** | An account's current balance = opening balance (from its start date) + money in − money out, including transfers. A channel's balance = opening + saved − withdrawn. The Accounts page, the net-worth "now" figures and the dashboard read these numbers, not a typed figure. | 1 |
| 3 | **Debt payments from transactions** | A ชำระหนี้ transaction writes the matching `DebtPayment`, using the interest and fee typed on the row. If they are left blank, it falls back to the computed split (`splitPayment`). Editing or deleting the transaction keeps the debt in sync. | 1 |
| 4 | **Plan actuals and goal progress** | Each plan item's `actual` and each goal's `saved` are computed from that month's transactions, not typed in: expense items by category, income items by income item, savings items by channel, goals by tag plus opening allocation. The seeded `MonthlyCashflow` and `DaySpend` tables are replaced by queries over transactions. | 1 (2 for opening balances) |
| 5 | **Planning helpers** | Plan rows can have an optional due day. A row with one is a bill for that month. Each row shows a suggested amount: last month's actual, the debt's minimum payment, or the goals' monthly saving. A positive end-of-month balance carries into the next month's opening. Bills tick themselves as paid by matching activity + item, counting occurrences. | 3, 4 |
| 6 | **Goal targets and overview** | Goal targets are inflation-adjusted, and the emergency-fund target comes from planned spending (formulas in planner §11). The overview shows "income does not cover the plan, find X more" or "you will have X left". Net-worth history is computed at each month end and no longer seeded. | 2, 4, 5 |

Phases 2 and 3 are independent of each other once Phase 1 lands, and could run in parallel.

## Deliberately not planned

- **Indirect withdrawal** (planner §2): in CashflowKub a credit card is an `Account` of kind `credit`, so paying with
  it already lowers that account's balance. Phase 1 requires the paying account to be an `Account`, so paying directly
  from a savings channel is not possible and needs no special handling.
- **Linking `Account(kind=credit)` to a revolving `Debt`.** The two ways of modelling credit lines stay separate for now.
- **The 12-month cap, yearly files, slot limits** (planner §13): the app has none of these, so there is nothing to build.
