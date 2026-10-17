# The spreadsheet planner CashflowKub replaces

Before CashflowKub, the owner kept their finances in a Google Sheets planner.
This note records everything the planner holds and calculates, read from the owner's 2026 files
(their data plus every formula), so the app can be designed to cover the same ground and do it better.

- [1. Files and how they connect](#1-files-and-how-they-connect)
- [2. Vocabulary](#2-vocabulary)
- [3. Setup (ตั้งค่า)](#3-setup-ตั้งค่า)
- [4. Daily transactions (ธุรกรรมรายวัน)](#4-daily-transactions-ธุรกรรมรายวัน)
- [5. Monthly plan (บันทึกแผน, สรุปแผน)](#5-monthly-plan-บันทึกแผน-สรุปแผน)
- [6. Bills with due dates](#6-bills-with-due-dates)
- [7. Overview (ภาพรวม)](#7-overview-ภาพรวม)
- [8. Debts (หนี้สิน)](#8-debts-หนี้สิน)
- [9. Savings goals (เป้าหมายสะสม)](#9-savings-goals-เป้าหมายสะสม)
- [10. Net worth (ความมั่งคั่งสุทธิ, ปรับปรุงทรัพย์สิน)](#10-net-worth-ความมั่งคั่งสุทธิ-ปรับปรุงทรัพย์สิน)
- [11. Formulas worth reusing](#11-formulas-worth-reusing)
- [12. The owner's data, January 2026](#12-the-owners-data-january-2026)
- [13. Limits and pain points](#13-limits-and-pain-points)
- [14. Mapping to CashflowKub](#14-mapping-to-cashflowkub)

---

## 1. Files and how they connect

| File | Role |
| --- | --- |
| `Y2026_FINANCIAL_<NAME>.xlsx` | **Yearly main file.** Setup, monthly plans, 12-month summaries, debts, goals, net worth |
| `Y2026_JAN_<NAME>.xlsx`, `…_FEB_…`, … | **Monthly file**, one per month. Daily transactions and that month's overview |

- On the yearly file's home sheet (หน้าแรก) the owner picks a **start date** (here 2026-01-01) and a **currency** (฿).
  Month *n*'s date is `EDATE(start, n-1)`, and there are 12 slots, each holding a monthly file's link.
- **Data flows both ways via `IMPORTRANGE`:**
  - yearly → monthly: setup lists (items, accounts, channels, debts, goals, opening balances) and the
    planned bills/budgets for that month (`frommain`, `frommain2`);
  - monthly → yearly: a per-month export (sheet `ToMain`) with account totals, debt payments, savings per goal,
    totals per item, daily spend and bill-paid flags. The yearly file stacks the 12 exports in sheet `month`.
- Every summary in the yearly file is built from `month`. If a link is missing, the summaries fill with `#N/A`.

Sheets in the yearly file: หน้าแรก (home), ตั้งค่า (setup), บันทึกแผน (plan log), สรุปแผน (plan summary),
ภาพรวม (overview), เป้าหมายสะสม (goals), ความมั่งคั่งสุทธิ (net worth), ปรับปรุงทรัพย์สิน (other assets),
หนี้สิน (debts), plus helpers `month`, `tomonth`, `cal1`, `cal2`, `DD`.

Sheets in a monthly file: หน้าแรก (home + link to yearly file), ธุรกรรมรายวัน (daily log), ภาพรวม (month overview),
plus helpers `CAL`, `ToMain`, `DUE`, `dup`, `fm`.

Sheets marked "computed" in the planner carry the banner *หน้านี้ไม่ต้องเพิ่มข้อมูล คำนวณอัตโนมัติ*.
Input sheets say *add data only in the white cells*.

## 2. Vocabulary

### Activities (กิจกรรม)

Each transaction has exactly one activity. The activity decides which list the item comes from
and which way money moves.

| Thai | Internal key | Item list | Direction |
| --- | --- | --- | --- |
| รับเงิน | Receive | income items | **into** an account (รับเข้าบัญชี) |
| จ่ายเงิน | Pay | expense items | **out of** an account (จ่ายด้วยบัญชี) |
| สะสมเงิน | Save | savings channels | out of an account, into the channel |
| ชำระหนี้ | PayOff / PayDebt | debts to pay off | out of an account |
| เบิกเงิน | Withdraw | savings channels + revolving credit lines | into an account |
| เปลี่ยนบัญชี | Adjust (transfer) | everyday accounts | into an account, out of the account named as item |

The direction column (ช่องทางรับเงิน-จ่ายเงิน label) is derived automatically:
จ่ายเงิน / สะสมเงิน / ชำระหนี้ → "จ่ายด้วยบัญชี"; รับเงิน / เบิกเงิน / เปลี่ยนบัญชี → "รับเข้าบัญชี".

A special income item **ผลตอบแทนการออม/ลงทุน** (savings/investment return) uses an "interest account" list,
so interest can be credited to a savings channel instead of an everyday account.

Items are keyed as `<activity>-<item>` (รายการแบบรวมคำ), e.g. `จ่ายเงิน-บริโภค`, `ชำระหนี้-กยศ`.
That key joins transactions to plans and bills.

### Groups used in summaries (กลุ่ม)

รายรับ · เงินสะสม · ค่าใช้จ่ายจำเป็น · ค่าใช้จ่ายอื่นๆ · หนี้สินที่ต้องการปิดยอด · หนี้สินที่ต้องการใช้วงเงินต่อ ·
เบิกถอนบัญชีเงินสะสม/หนี้สิน · เงินคงเหลือเริ่มต้น (opening balance).

### Account groups (กลุ่มบัญชี)

1. **บัญชีรับเงิน-จ่ายเงิน**: everyday accounts money flows through.
   Sub-types: เงินสด, เงินฝากธนาคาร, เงินใน E-Wallet.
2. **บัญชีสะสมเงิน / ทรัพย์สินทางการเงิน** ("Port"): savings and investment channels.
3. **บัญชีหนี้สินที่ต้องการใช้วงเงิน**: revolving credit lines (credit card, cash card) kept in use.

### Indirect withdrawal

If a รับเงิน or จ่ายเงิน row names a savings channel or credit line as its account (e.g. paying straight from a
credit card), the planner counts it as an **indirect withdrawal** (เบิกเงินทางอ้อม / รายรับจากยอดที่ไม่เบิกโดยตรง)
from that channel or line, as well as the income or expense. This keeps channel and credit-line balances right.

## 3. Setup (ตั้งค่า)

Three steps on one sheet.

### Step 1/3: items, channels, accounts

| Block | Fields | Slots |
| --- | --- | --- |
| รายรับ (income items) | name | 16 |
| ค่าใช้จ่าย (expense items) | name, class: **ค่าใช้จ่ายจำเป็น** or **ค่าใช้จ่ายอื่นๆ** | 30 |
| ช่องทางการสะสม / ลงทุน (savings channels) | name, asset sub-type, opening value, date of value | 15 |
| บัญชีรับเงิน-จ่ายเงิน (everyday accounts) | name, sub-type, opening balance, date of balance | 12 |

The opening balance only counts from its date onward, so an account can be added mid-year.

### Step 2/3: debts

**หนี้สินที่ต้องการปิดยอด** (to pay off), 15 slots:

| Field | Notes |
| --- | --- |
| วันที่บันทึกข้อมูล | date the figures are as of |
| ชื่อหนี้สิน, หมวดหมู่ย่อย | name, debt sub-type |
| วงเงินทั้งหมด | limit / original principal |
| ยอดที่ชำระแล้ว | amount already repaid |
| % ดอกเบี้ยต่อปี | annual rate |
| วิธีคิดดอกเบี้ย | **ลดต้นลดดอก** (reducing) or **คงที่** (flat) |
| จำนวนเดือนปิดยอด | target months to close |
| ยอดชำระขั้นต่ำต่อเดือน | computed, "อัตโนมัติ" if months blank |
| ยอดหนี้สินเริ่มต้น | computed = limit − already repaid |
| ดอกเบี้ยเริ่มต้น | computed = starting balance × rate / 12 |

**หนี้สินที่ต้องการใช้วงเงินต่อ** (revolving), 15 slots: name, sub-type, limit, available amount (ยอดที่ใช้ได้),
annual rate, method, minimum payment.

Debt sub-types: บัตรเครดิต, บัตรกดเงินสด, สินเชื่อส่วนบุคคล, เงินกู้ยืมเพื่อการศึกษา, สินเชื่อที่อยู่อาศัย,
สินเชื่อยานยนต์, หนี้สินจากการจำนอง, หนี้สินอื่นๆ.

### Step 3/3: savings goals

- **เงินสำรองเผื่อฉุกเฉิน 6 เดือน** (emergency fund): start, end, inflation %, target (auto or typed).
- **เงินเพื่อเกษียณ** (retirement): start date, monthly spend wanted in retirement (ต้องการใช้เงินเดือนละ),
  current age, retirement age, age the money must last to, inflation %. End date and target computed.
- **เป้าหมายกำหนดเอง 1–5** (custom): name, start, end, inflation %, target amount.

Every goal then splits across up to 10 savings channels: % share per channel (must total 100%),
an opening value already set aside for this goal, and the computed monthly saving.
A channel's opening value not yet given to a goal shows as **มูลค่ารอจัดสรร** (waiting to be allocated).

## 4. Daily transactions (ธุรกรรมรายวัน)

One grid per monthly file, 650 rows.

| Column | Input? | Notes |
| --- | --- | --- |
| วันที่ | yes | date, must fall in the file's month |
| กิจกรรม | yes | activity (dropdown) |
| รายการ | yes | item, dropdown filtered by activity |
| ช่องทางรับเงิน-จ่ายเงิน | label auto, account yes | direction label + the account used |
| ยอดเงิน | yes | amount |
| กรณีชำระหนี้สิน: ดอกเบี้ย | yes | interest part of a debt payment |
| กรณีชำระหนี้สิน: ค่าธรรมเนียมอื่นๆ | yes | fees other than interest |
| กรณีเงินสะสม: เลือกเป้าหมาย | yes | goal this saving counts toward |
| โน้ต | yes | free note |
| มีกำหนดจ่ายไหม? | auto | `Y` when activity-item matches a planned bill this month |
| ยอดชำระ − ค่าธรรมเนียม | auto | for ชำระหนี้: amount − fee |
| เหลือเงินต้น | auto | principal paid = amount − fee − interest |
| เงื่อนไข Port | auto | `Y` if savings-related (activity สะสมเงิน, item is a channel, or ผลตอบแทนการออม/ลงทุน) |

Left panel **สรุปธุรกรรมตามวันที่เลือก**: pick a date to see that day's totals by group
(รายรับ, เงินสะสม/การลงทุน, ค่าใช้จ่ายจำเป็น, ค่าใช้จ่ายอื่นๆ, ชำระหนี้สิน) and a per-item breakdown.

What the month exports to the yearly file (`ToMain`), at month end:

- per account: money in, money out, balance change;
- per debt: payment, fee, payment − fee, interest, principal paid;
- per savings channel × goal: amount saved;
- per activity-item: total, plus indirect withdrawals;
- per day: actual spend split into "with a due date" and "without a due date";
- per planned bill: paid or not.

## 5. Monthly plan (บันทึกแผน, สรุปแผน)

### Plan log (บันทึกแผน): input

Three side-by-side lists, up to 750 rows each. Every row: month (เลือกเดือน/ปี), item, planned amount,
and a **suggested amount** (แนะนำ) shown beside it.

| List | Due date? | Suggested amount (แนะนำ) |
| --- | --- | --- |
| วางแผนรายรับ (income) | no | last month's actual for this item |
| วางแผนค่าใช้จ่ายและหนี้สิน (expenses + debt payments) | optional day of month | expense: last month's actual; debt: its minimum payment, while the debt is still within its months to close |
| วางแผนเงินสะสม (savings) | optional | sum of active goals' monthly saving for that channel, in that month |

An expense or saving row **with** a due date becomes a bill (section 6).
Rows **without** a due date form the day-to-day budget.

### Plan summary (สรุปแผน): computed, 12 months forward

Columns are months from the start date. Rows:

- เงินคงเหลือ ณ สิ้นเดือน (end-of-month balance) = total in − (savings + expenses and debts)
- รวมรายรับ = opening balance + income + withdrawals
  - เงินคงเหลือเริ่มต้น: month 1 = opening balances dated up to that month;
    later months = new opening balances in that month + **last month's end balance if positive** (carry-forward)
  - รายรับ: planned income per item
  - เบิกถอนบัญชีสะสม/สินเชื่อ: planned withdrawals
- รวมการสะสม/การลงทุน: planned savings per channel
- รวมค่าใช้จ่ายและหนี้สิน: planned expenses per item + planned debt payments per debt

## 6. Bills with due dates

- **Source:** plan rows with a due date (expenses, debt payments, savings). Due date = that day in the planned month.
- **Paid?:** a bill is paid when the month has a transaction with the same `activity-item`.
  Matching is by occurrence: the 2nd bill for `จ่ายเงิน-X` in a month needs a 2nd `จ่ายเงิน-X` transaction.
- **Shown:** a list per month (or all), 15 per page, with item, amount, due date and a paid tick.
  The monthly file also flags each transaction that settles a bill (มีกำหนดจ่ายไหม? = `Y`).

## 7. Overview (ภาพรวม)

Both files have an overview; the yearly one spans months, the monthly one a single month.

1. **Bills and account balances**
   - Bills due (section 6) for a chosen month.
   - Balance per account, in three tabs: everyday accounts, savings channels, revolving credit lines.
     Balance = opening balance (if dated on or before) + money in − money out.
   - The monthly overview can show movement over the last 1 month / 7 / 14 / 28 days.
2. **Debt progress** (yearly only), grouped by debt sub-type: limit, paid, remaining, % paid.
   For revolving lines: limit, available amount.
3. **Goal progress** (yearly only): each goal's target, saved, remaining; total across goals.
4. **Plan vs actual** for a month range:
   - **Actual income vs planned spending.** Message is either "income is not enough for the plan, you need X more"
     (รายรับจริงยังไม่เพียงพอ… ต้องหาเพิ่มอีก) or "income covers the plan, you will have X left".
   - Totals, plan vs actual, for income (target vs received), remaining cash (budget vs actual, and % of income),
     and savings + expenses + debts (budget vs actual).
   - By group: actual, % of income, planned, for เงินสะสม · ค่าใช้จ่ายจำเป็น · ค่าใช้จ่ายอื่นๆ · หนี้สินปิดยอด · หนี้ที่ใช้วงเงินต่อ.
   - Detail per item, paged, for income (status: ต้องหาเงินเพิ่ม or ถึงเป้าหมาย), savings,
     and expenses + debts (status: ใช้เงินเกินงบ or งบคงเหลือ).
   - A pie of income vs savings vs expenses vs remaining.
5. **Daily spending, planned vs actual**
   - Daily budget (งบสำหรับใช้จ่ายต่อวัน) = planned expenses **without** a due date ÷ days in the month.
     In the start month, days count from the start day.
   - Per day: planned (bills due that day + daily budget) vs actual.
     Filter: all / only bills with due dates / only spending without a due date.
   - Average per day across the chosen months.

## 8. Debts (หนี้สิน)

Computed sheet with two views: debts to pay off and revolving lines.

### Debts to pay off

- **Ranking:** sort by monthly payment, remaining balance, or annual rate (largest first).
- **Per debt:** starting balance, rate, interest method, target months, planned months vs months now needed,
  month it closes (เดือนที่ปิดยอด), average monthly payment and interest, months left.
- **Amortisation table, month by month** (payment, principal, interest, remaining):
  - payment = the actual payment logged that month (amount − fee); if none, the minimum payment;
  - interest = the interest logged on the transaction; if none, the computed interest:
    flat → fixed `starting balance × rate / 12`; reducing → `remaining × rate / 12`;
  - principal = payment − interest; remaining falls until it reaches zero;
  - the last payment is capped at remaining + interest; past month 12 it projects with minimum payments;
  - a tick marks months that had a real payment.
- **Paid so far** = Σ(payment − fee) − Σ interest + already repaid at setup.
  **Remaining** = limit − paid so far (not below 0).

### Revolving lines

- Available = setup available amount + principal repaid − withdrawals − indirect withdrawals.
- Minimum payment = principal + interest; interest = rate/12 × balance (reducing) or × limit (flat).

## 9. Savings goals (เป้าหมายสะสม)

Pick a goal to see: target, saved, remaining, % done, the end date (ภายใน), time left
(in days if under a month, otherwise months), and the average saving needed per day or month.

Below that, per savings channel: monthly plan, target share, saved, remaining.

- **Saved for a goal** = Σ savings transactions tagged with that goal, per channel + opening value given to the goal.
- **Monthly plan** counts only goals that have started and not ended, and still have something left.

## 10. Net worth (ความมั่งคั่งสุทธิ, ปรับปรุงทรัพย์สิน)

The owner types only a **net-worth target**. Everything else is computed at each month end for 12 months:

| Line | Month-end value |
| --- | --- |
| Everyday accounts | opening (if dated ≤ month end) + Σ in − Σ out − transfers out |
| Savings channels | opening + Σ สะสมเงิน − Σ เบิกเงิน |
| Other assets | value typed for that month on ปรับปรุงทรัพย์สิน, else last month's value carried forward |
| Debts (−) | starting balance − principal repaid + withdrawals (revolving) |
| **Net worth** | total assets − total debts |

Also shown:

- **Progress to target**: current net worth vs target, distance left, a 5-step bar.
- **Change from start**: ▲/▼, amount, %, per line and in total.
- **Breakdown by roll-up group** (as amounts or % of total), with a chart:
  เงินสด/เงินฝาก/e-wallet · ทรัพย์สินทางการเงิน · อสังหาริมทรัพย์ · ยานพาหนะ · ทรัพย์สินมีตัวตน · ทรัพย์สินไม่มีตัวตน · หนี้สิน (−) · อื่นๆ,
  and by sub-type.

**ปรับปรุงทรัพย์สิน** (other assets): 15 rows of name + sub-type, then one value cell per month.
The asset starts in the first month with a value.

Asset sub-types: เงินสด, เงินฝากธนาคาร, เงินใน E-Wallet (→ cash group); มูลค่าประกัน, พันธบัตร, หุ้นกู้, หุ้นสามัญ,
หุ้นบุริมสิทธิ, ตราสารอนุพันธ์, กองทุน, ทรัพย์สินทางการเงินอื่นๆ (→ financial); อสังหาริมทรัพย์; ยานพาหนะ;
เครื่องประดับ/อัญมณี, สิ่งของหายากและมูลค่าสูง, ทรัพย์สินมีตัวตนอื่นๆ (→ tangible);
ลิขสิทธิ์, เครื่องหมายการค้า, ซอฟต์แวร์คอมพิวเตอร์, ทรัพย์สินไม่มีตัวตนอื่นๆ (→ intangible).

## 11. Formulas worth reusing

| What | Formula |
| --- | --- |
| Starting debt balance | `limit − alreadyRepaid` |
| Minimum payment, flat | `(balance + balance × rate/12 × months) / months` |
| Minimum payment, reducing | `PMT(rate/12, months, −balance)` |
| Monthly interest, flat | `startingBalance × rate / 12` (fixed) |
| Monthly interest, reducing | `remaining × rate / 12` |
| Principal on a payment | `amount − fee − interest` |
| Emergency fund target | `avg(monthly planned expenses + debts, over months that have a plan) × 6 × (1 + inflation)^years(start, end)` |
| Retirement end date | `start + (retireAge − currentAge) years` |
| Retirement target | `monthlySpend × (lifeAge − retireAge) × 12 × (1 + inflation)^(lifeAge − currentAge)` |
| Custom goal target | `amount × (1 + inflation)^years(start, end)` |
| Goal monthly saving per channel | `target × channelShare% / months(start, end)` (1 if under 30 days) |
| Daily budget | `Σ planned no-due-date expenses ÷ days in month` (start month: from start day) |
| Plan opening balance | month 1: openings; later: new openings + max(0, previous end balance) |
| Change % | `(latest − start) / |start|`; ±100% when start is 0 |

## 12. The owner's data, January 2026

Start date 2026-01-01, currency ฿.

**Everyday accounts:**

| Account | Sub-type | Opening balance |
| --- | --- | --- |
| กรุงไทย | เงินฝากธนาคาร | 5,508.53 |
| เงินสด | เงินสด | – |
| กสิกร (มีสมุดคู่ฝาก) | เงินฝากธนาคาร | 55.88 |
| กสิกร ออนไลน์ | เงินฝากธนาคาร | – |

**Income items:** ผลตอบแทนการออม/ลงทุน (no others named yet).

**Expense items:**

| Item | Class |
| --- | --- |
| ใช้จ่ายส่วนตัว | ค่าใช้จ่ายอื่นๆ |
| บริโภค | ค่าใช้จ่ายจำเป็น |
| อุปโภค | ค่าใช้จ่ายจำเป็น |
| การทำงาน | ค่าใช้จ่ายจำเป็น |
| การศึกษา | ค่าใช้จ่ายอื่นๆ |
| ครอบครัว | ค่าใช้จ่ายอื่นๆ |
| ให้น้อง | ค่าใช้จ่ายอื่นๆ |

**Savings channels:** none set up. **Other assets:** none. **Revolving lines:** none.

**Debts to pay off** (all as of 2026-01-01):

| Debt | Sub-type | Limit | Repaid | Start balance | Rate | Method | Months | Min / month | First-month interest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| กรุงไทยใจป้ำ | สินเชื่อส่วนบุคคล | 70,000 | 24,300 | 45,700 | 25% | ลดต้นลดดอก | 21 | 2,709.07 | 952.08 |
| KKB NANO | สินเชื่อส่วนบุคคล | 53,824.10 | 0 | 53,824.10 | 33% | คงที่ | 36 | 2,975.28 | 1,480.16 |
| SPEC | สินเชื่อส่วนบุคคล | 28,663 | 0 | 28,663 | 33% | คงที่ | 10 | 3,654.53 | 788.23 |
| กยศ | เงินกู้ยืมเพื่อการศึกษา | 186,150 | 0 | 186,150 | 5% | ลดต้นลดดอก | 96 | 2,356.64 | 775.63 |

Total start debt ≈ ฿314,337; total minimum payments ≈ ฿11,695 / month.

**Goals:**

| Goal | Start → end | Inflation | Target | Split |
| --- | --- | --- | --- | --- |
| เงินสำรองเผื่อฉุกเฉิน 6 เดือน | – | – | auto (no plan yet) | – |
| เงินเพื่อเกษียณ | – | – | not filled in | – |
| ดาวน์รถ | 2026-01-01 → 2026-06-30 | 4% | 50,000 | 100% to one channel (not named) |

**Net-worth target:** not set. **Plan log:** empty.

**January transactions (6).** Item and account columns were left blank; only activity, amount and note were filled.

| Date | Activity | Amount | Note |
| --- | --- | --- | --- |
| 1 Jan | รับเงิน | 100.00 | ย่าให้ |
| 1 Jan | รับเงิน | 2.26 | ดอกเบี้ย |
| 1 Jan | จ่ายเงิน | 100.00 | ทำบุญชำระหนี้สงฆ์ |
| 1 Jan | จ่ายเงิน | 1,358.00 | จ่ายหนี้ |
| 1 Jan | จ่ายเงิน | 415.00 | จ่ายหนี้ |
| 2 Jan | จ่ายเงิน | 550.00 | true money |

Observations:

- Debt repayments were logged as จ่ายเงิน with a note, not as ชำระหนี้, so the debt sheet saw no payments.
- With item and account blank, no account balance, plan-vs-actual or goal figure could use these rows.
- ดอกเบี้ย 2.26 is what the planner's ผลตอบแทนการออม/ลงทุน item is for.
- "true money" (TrueMoney Wallet) is an e-wallet that wasn't set up as an account.

## 13. Limits and pain points

- 13 linked files a year; links pasted by hand; any missing link breaks summaries
  (`#N/A`, `#NUM!`, `#DIV/0!` seen in the owner's files).
- Fixed slot counts: 16 income items, 30 expense items, 15 channels, 12 accounts, 15 debts, 15 revolving lines,
  5 custom goals, 10 channels per goal, 15 other assets, 650 transactions a month, 12 months.
- Each month must be "closed" into the yearly file before yearly views are right.
- Built for PC/laptop; logging on a phone is awkward.
- A correct debt payment needs activity ชำระหนี้, the debt as item, the account, and interest and fee typed by hand.
  In practice the owner skipped this.
- Item and account dropdowns are required for anything to add up, but nothing stops a row without them.
- A year ends at 12 months; next year is a new set of files.

## 14. Mapping to CashflowKub

Current models are in `cashflowkub/prisma/schema.prisma`.

| Planner | CashflowKub |
| --- | --- |
| Start date, currency | Setting |
| Income items | IncomeCategory |
| Expense items + class (จำเป็น / อื่นๆ) | Category |
| Everyday accounts | Account |
| Savings channels (Port) | Channel |
| Debts to pay off, revolving lines | Debt, DebtPayment |
| Goals (emergency, retirement, custom) + channel split | SetupGoal, SetupGoalChannel, Goal |
| Daily transactions | Transaction (spreadsheet grid, monthly sheet) |
| Plan log with due dates | PlanItem, Bill |
| Plan summary, 12 months | MonthlyCashflow, Plan screen |
| Overview plan vs actual, daily spend | Dashboard, Reports, Budgets, DaySpend |
| Debts sheet (ranking, amortisation) | Debts screen (schedule, avalanche/snowball, flat vs reducing) |
| Goals sheet | Goals screen |
| Net worth, other assets | Net Worth screen, Asset, AssetSnapshot, NetWorthHistory |
| Tax links on home sheet | Tax planner screen |

Goals (the `Goal` model behind `/goals`) are added, edited and deleted in the app. Transactions tag a savings goal by
**name**, so goal names are unique ignoring case and spaces (409 `goalNameTaken`), renaming a goal renames its tags, and a
goal with tagged transactions cannot be deleted (409 `goalInUse`). `Goal.saved` is typed in by hand; it is not yet
computed from tagged savings transactions as the planner does (section 9).

Bills (the `Bill` model behind `/bills`) are recurring templates planned month by month. `startMonth`, optional `endMonth`,
`freq` (`monthly` = recurring, `once` = only in `startMonth`) and `everyMonths` (1-12) decide which months a bill occurs in;
a one-time bill is entered as an exact date (stored as `startMonth` + `dueDay`). Paid state is per month, one row per bill
per month in `bill_payments`; `Bill.paid` is deprecated and unread. A due day past a month's end falls on its last day.
Unlike the spreadsheet planner (section 6), paid is ticked by hand, not matched from transactions.

Behaviour to check the app covers, since the planner relies on it:

- transfer between accounts (เปลี่ยนบัญชี) and withdrawal from a channel or credit line (เบิกเงิน);
- indirect withdrawal when paying straight from a credit line or channel;
- interest and fee on a debt payment, falling back to computed interest when left blank;
- suggested plan amounts (last month's actual, debt minimum, goal monthly saving);
- bill paid-matching by `activity-item` and occurrence count;
- opening balances that take effect from a date;
- plan carry-forward of a positive end balance;
- goal targets with inflation, and the emergency-fund target from planned spending.
