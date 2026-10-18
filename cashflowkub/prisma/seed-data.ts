// Canonical CashflowKub demo data, ported verbatim from api/internal/seed/seed.go
// (itself lifted from the design comp). Row order matters: ids are assigned in order.
import type { Prisma } from '../src/generated/prisma/client';

const MONTH = '2026-06';
const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export const categories: Prisma.CategoryCreateManyInput[] = [
  { key: 'food', label: 'Food & Dining', th: 'อาหาร', short: 'Food', icon: 'utensils', tint: 'folder', type: 'expense', sub: 'need', sort: 1 },
  { key: 'transport', label: 'Transport', th: 'เดินทาง', short: 'Transit', icon: 'car', tint: 'doc', type: 'expense', sub: 'need', sort: 2 },
  { key: 'shopping', label: 'Shopping', th: 'ช้อปปิ้ง', short: 'Shop', icon: 'shopping-bag', tint: 'image', type: 'expense', sub: 'want', sort: 3 },
  { key: 'bills', label: 'Bills', th: 'บิล', short: 'Bills', icon: 'receipt', tint: 'pdf', type: 'expense', sub: 'need', sort: 4 },
  { key: 'fun', label: 'Entertainment', th: 'บันเทิง', short: 'Fun', icon: 'clapperboard', tint: 'video', type: 'expense', sub: 'want', sort: 5 },
  { key: 'health', label: 'Health', th: 'สุขภาพ', short: 'Health', icon: 'heart-pulse', tint: 'xls', type: 'expense', sub: 'need', sort: 6 },
  { key: 'income', label: 'Income', th: 'รายรับ', short: 'Income', icon: 'arrow-down-left', tint: 'xls', type: 'income', sub: '', sort: 7 },
  { key: 'saving', label: 'Savings & Investing', th: 'เงินสะสม / การลงทุน', short: 'Saving', icon: 'piggy-bank', tint: 'xls', type: 'expense', sub: 'saving', sort: 8 },
  { key: 'debt', label: 'Debt payment', th: 'ชำระหนี้สิน', short: 'Debt', icon: 'hand-coins', tint: 'pdf', type: 'expense', sub: 'debt', sort: 9 },
];

export const accounts: Prisma.AccountCreateManyInput[] = [
  { name: 'Kasikorn Savings', sub: 'KBank ••4821', balance: 128400, icon: 'landmark', tint: 'doc', kind: 'bank', startDate: 'Mar 1, 2019', startTh: '1 มี.ค. 2019', sort: 1 },
  { name: 'SCB Current', sub: 'SCB ••0192', balance: 42580, icon: 'landmark', tint: 'xls', kind: 'bank', startDate: 'Jul 12, 2020', startTh: '12 ก.ค. 2020', sort: 2 },
  { name: 'Cash Wallet', sub: 'เงินสด', balance: 3200, icon: 'banknote', tint: 'folder', kind: 'cash', startDate: 'Always', startTh: 'ตลอด', sort: 3 },
  { name: 'TrueMoney', sub: 'e-Wallet', balance: 1850, icon: 'wallet', tint: 'image', kind: 'ewallet', startDate: 'Sep 4, 2021', startTh: '4 ก.ย. 2021', sort: 4 },
  { name: 'KTC Credit', sub: '••7733', balance: -18200, icon: 'credit-card', tint: 'pdf', kind: 'credit', startDate: 'May 22, 2022', startTh: '22 พ.ค. 2022', sort: 5 },
];

export const transactions: Prisma.TransactionCreateManyInput[] = [
  { name: 'Monthly Salary', cat: 'income', activity: 'receive', item: 'Monthly salary', acct: 'Kasikorn Savings', amount: 62000, date: d('2026-06-18'), note: 'Acme Co. payroll' },
  { name: 'Starbucks', cat: 'food', acct: 'SCB Current', amount: -185, date: d('2026-06-18'), note: 'Latte + croissant' },
  { name: 'Grab', cat: 'transport', acct: 'TrueMoney', amount: -120, date: d('2026-06-18'), note: 'Ride to office' },
  { name: '7-Eleven', cat: 'food', acct: 'Cash Wallet', amount: -248, date: d('2026-06-17'), note: 'Snacks' },
  { name: 'Netflix', cat: 'fun', acct: 'KTC Credit', amount: -419, date: d('2026-06-17'), note: 'Premium plan' },
  { name: 'PEA Electricity', cat: 'bills', acct: 'SCB Current', amount: -1240, date: d('2026-06-17'), note: 'June bill' },
  { name: 'Central Ladprao', cat: 'shopping', acct: 'KTC Credit', amount: -2890, date: d('2026-06-15'), note: 'Clothes' },
  { name: 'BTS Rabbit top-up', cat: 'transport', acct: 'TrueMoney', amount: -400, date: d('2026-06-15'), note: 'Commute card' },
  { name: 'Boots Pharmacy', cat: 'health', acct: 'SCB Current', amount: -560, date: d('2026-06-15'), note: 'Vitamins' },
  { name: 'Lazada', cat: 'shopping', acct: 'KTC Credit', amount: -1150, date: d('2026-06-14'), note: 'Phone case' },
  { name: 'Foodpanda', cat: 'food', acct: 'SCB Current', amount: -320, date: d('2026-06-14'), note: 'Dinner' },
  { name: 'Fitness First', cat: 'health', acct: 'SCB Current', amount: -1500, date: d('2026-06-13'), note: 'Membership' },
];

export const budgets: Prisma.BudgetCreateManyInput[] = [
  { cat: 'shopping', spent: 6500, limit: 5000, sort: 1 },
  { cat: 'food', spent: 4200, limit: 5000, sort: 2 },
  { cat: 'bills', spent: 3200, limit: 3500, sort: 3 },
  { cat: 'transport', spent: 1800, limit: 2500, sort: 4 },
  { cat: 'health', spent: 1100, limit: 1500, sort: 5 },
  { cat: 'fun', spent: 900, limit: 1500, sort: 6 },
];

export const goals: Prisma.GoalCreateManyInput[] = [
  { name: 'Emergency Fund', th: 'เงินสำรองฉุกเฉิน', icon: 'shield', saved: 145000, target: 200000, monthly: 8000, by: 'Ongoing', sort: 1 },
  { name: 'Japan Trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', saved: 64000, target: 120000, monthly: 6000, by: 'Dec 2026', sort: 2 },
  { name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', saved: 28000, target: 45000, monthly: 3000, by: 'Sep 2026', sort: 3 },
];

// paid = openingPaid + Σ principal of that debt's seeded payments (asserted in tests/api/seed.test.ts).
// Shopee rows are illustrative demo terms, not Shopee's published rates/fees.
export const debts: Prisma.DebtCreateManyInput[] = [
  { name: 'Student Loan (กยศ)', th: 'กยศ', icon: 'graduation-cap', tint: 'doc', kind: 'personal', lender: 'กยศ', original: 186650, openingPaid: 8275, paid: 8275, apr: 0, monthly: 3889, calc: 'flat', dueDay: 28, sort: 1 },
  { name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', kind: 'bankloan', lender: 'Krungthai Bank', original: 70000, openingPaid: 24300, paid: 24300, apr: 25, monthly: 2783, calc: 'reducing', dueDay: 25, sort: 2 },
  { name: 'Kbank Nano 3', th: 'Kbank Nano 3', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 12000, openingPaid: 4570, paid: 4570, apr: 33, monthly: 1523, calc: 'reducing', dueDay: 25, revolving: true, sort: 3 },
  { name: 'SPEC 3 Personal', th: 'SPEC 3', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 9593, openingPaid: 5300, paid: 5300, apr: 33, monthly: 1607, calc: 'reducing', dueDay: 20, sort: 4 },
  { name: 'Kbank Nano 2', th: 'Kbank Nano 2', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 8000, openingPaid: 5400, paid: 5400, apr: 33, monthly: 1016, calc: 'reducing', dueDay: 25, revolving: true, sort: 5 },
  { name: 'SPEC 4', th: 'SPEC 4', icon: 'receipt', tint: 'doc', kind: 'cashloan', lender: 'SPEC', original: 7789, openingPaid: 7789, paid: 7789, apr: 33, monthly: 948, calc: 'reducing', done: true, sort: 6 },
  { name: 'iPhone 16 / PQ', th: 'ผ่อน iPhone 16 กับ PQ', icon: 'smartphone', tint: 'image', kind: 'personal', lender: 'PQ', original: 30580, openingPaid: 30580, paid: 30580, apr: 0, monthly: 3058, calc: 'flat', done: true, sort: 7 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', icon: 'bike', tint: 'doc', kind: 'personal', original: 14885, openingPaid: 14885, paid: 14885, apr: 0, monthly: 2977, calc: 'flat', done: true, sort: 8 },
  { name: 'iPhone Piggybank', th: 'ยืมกระปุก IPHONE', icon: 'piggy-bank', tint: 'folder', kind: 'personal', original: 15800, openingPaid: 15800, paid: 15800, apr: 0, monthly: 7900, calc: 'flat', done: true, sort: 9 },
  { name: 'Kbank Nano 1', th: 'Kbank Nano', icon: 'credit-card', tint: 'pdf', kind: 'cashloan', lender: 'KBank', original: 5000, openingPaid: 5000, paid: 5000, apr: 33, monthly: 635, calc: 'reducing', done: true, sort: 10 },
  { name: 'SPEC 1', th: 'SPEC 1', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 4032, openingPaid: 4032, paid: 4032, apr: 31.4, monthly: 898, calc: 'reducing', done: true, sort: 11 },
  { name: 'SPEC 2', th: 'SPEC 2', icon: 'receipt', tint: 'pdf', kind: 'cashloan', lender: 'SPEC', original: 5514, openingPaid: 5514, paid: 5514, apr: 33, monthly: 915, calc: 'reducing', done: true, sort: 12 },
  { name: 'Water Heater / PQ', th: 'เครื่องทำน้ำอุ่น พี่คิว', icon: 'shower-head', tint: 'image', kind: 'personal', lender: 'PQ', original: 1886, openingPaid: 1886, paid: 1886, apr: 0, monthly: 629, calc: 'flat', done: true, sort: 13 },
  { name: 'Desk & Keyboard', th: 'โต๊ะ และ คีย์บอร์ด', icon: 'monitor', tint: 'doc', kind: 'personal', original: 2137, openingPaid: 2137, paid: 2137, apr: 0, monthly: 712, calc: 'flat', done: true, sort: 14 },
  // id 15: SPayLater-style, fixed statement instalment, paid this cycle.
  { name: 'Shopee SPayLater', th: 'ช้อปปี้ เพย์เลเตอร์', icon: 'shopping-bag', tint: 'image', kind: 'paylater', lender: 'Shopee', original: 7500, openingPaid: 0, paid: 3750, apr: 0, calc: 'flat', fixedPayment: 1250, termMonths: 6, dueDay: 1, revolving: true, sort: 15 },
  // id 16: EasyCash-style flat-rate cash loan, June instalment missed (overdue with a late fee).
  { name: 'Shopee EasyCash', th: 'ช้อปปี้ อีซี่แคช', icon: 'hand-coins', tint: 'folder', kind: 'cashloan', lender: 'Shopee', original: 20000, openingPaid: 0, paid: 5001, apr: 18, calc: 'flat', termMonths: 12, dueDay: 5, lateFee: 100, sort: 16 },
];

export const debtPayments: Prisma.DebtPaymentCreateManyInput[] = [
  { debtId: 15, date: d('2026-04-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement Apr' },
  { debtId: 15, date: d('2026-05-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement May' },
  { debtId: 15, date: d('2026-06-01'), amount: 1250, principal: 1250, interest: 0, fee: 0, note: 'Statement Jun' },
  { debtId: 16, date: d('2026-03-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
  { debtId: 16, date: d('2026-04-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
  { debtId: 16, date: d('2026-05-05'), amount: 1967, principal: 1667, interest: 300, fee: 0, note: '' },
];

export const settings: Prisma.SettingCreateManyInput[] = [{ key: 'monthlyIncome', value: '62000' }];

export const assets: Prisma.AssetCreateManyInput[] = [
  { name: 'Kasikorn Savings', th: 'ออมทรัพย์ กสิกร', icon: 'landmark', tint: 'doc', value: 128400, sort: 1 },
  { name: 'SCB Current', th: 'กระแสรายวัน SCB', icon: 'landmark', tint: 'xls', value: 42580, sort: 2 },
  { name: 'Cash Wallet', th: 'เงินสด', icon: 'banknote', tint: 'folder', value: 3200, sort: 3 },
  { name: 'TrueMoney Wallet', th: 'TrueMoney', icon: 'wallet', tint: 'image', value: 1850, sort: 4 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', icon: 'trending-up', tint: 'xls', value: 82400, sort: 5 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', icon: 'piggy-bank', tint: 'xls', value: 48500, sort: 6 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', icon: 'bike', tint: 'doc', value: 22000, sort: 7 },
  { name: 'Electronics & Gear', th: 'อุปกรณ์อิเล็กทรอนิกส์', icon: 'monitor', tint: 'image', value: 35000, sort: 8 },
];

export const bills: Prisma.BillCreateManyInput[] = [
  { name: 'Spotify Family', th: 'Spotify Family', icon: 'music', tint: 'image', amount: 149, dueDay: 1, paid: true, freq: 'monthly', cat: 'fun', kind: 'subscription', sort: 1 },
  { name: 'Netflix Premium', th: 'Netflix Premium', icon: 'clapperboard', tint: 'video', amount: 419, dueDay: 3, paid: true, freq: 'monthly', cat: 'fun', kind: 'subscription', sort: 2 },
  { name: 'Apartment Rent', th: 'ค่าเช่าบ้าน', icon: 'house', tint: 'folder', amount: 12000, dueDay: 5, paid: true, freq: 'monthly', cat: 'bills', sort: 3 },
  { name: 'PEA Electricity', th: 'ค่าไฟ PEA', icon: 'zap', tint: 'pdf', amount: 1240, dueDay: 10, paid: true, freq: 'monthly', cat: 'bills', sort: 4 },
  { name: 'AIS Fiber Internet', th: 'AIS Fiber อินเทอร์เน็ต', icon: 'wifi', tint: 'doc', amount: 590, dueDay: 15, paid: true, freq: 'monthly', cat: 'bills', sort: 5 },
  { name: 'KTC Credit Card', th: 'บัตรเครดิต KTC', icon: 'credit-card', tint: 'pdf', amount: 2500, dueDay: 16, paid: false, freq: 'monthly', cat: 'debt', sort: 6 },
  { name: 'MEA Water', th: 'ค่าน้ำประปา', icon: 'droplet', tint: 'doc', amount: 180, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', sort: 7 },
  { name: 'AIS Mobile', th: 'AIS มือถือ', icon: 'smartphone', tint: 'image', amount: 399, dueDay: 20, paid: false, freq: 'monthly', cat: 'bills', sort: 8 },
  { name: 'Kbank Nano 3', th: 'Kbank Nano 3', icon: 'credit-card', tint: 'pdf', amount: 1523, dueDay: 25, paid: false, freq: 'monthly', cat: 'debt', sort: 9 },
  { name: 'KrungThai Personal', th: 'กรุงไทยใจป้ำ', icon: 'landmark', tint: 'pdf', amount: 2783, dueDay: 25, paid: false, freq: 'monthly', cat: 'debt', sort: 10 },
  { name: 'Student Loan (กยศ)', th: 'กยศ', icon: 'graduation-cap', tint: 'doc', amount: 3889, dueDay: 28, paid: false, freq: 'monthly', cat: 'debt', sort: 11 },
  { name: 'AIA Life Insurance', th: 'ประกันชีวิต AIA', icon: 'shield', tint: 'xls', amount: 1850, dueDay: 30, paid: false, freq: 'monthly', cat: 'bills', sort: 12 },
  { name: 'iCloud+ 200GB', th: 'iCloud+ 200GB', icon: 'cloud', tint: 'image', amount: 99, dueDay: 30, paid: false, freq: 'monthly', cat: 'fun', kind: 'subscription', sort: 13 },
];

export const channels: Prisma.ChannelCreateManyInput[] = [
  { name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', kind: 'saving', icon: 'piggy-bank', tint: 'doc', opening: 35000, startDate: 'Jan 1, 2025', startTh: '1 ม.ค. 2025', sort: 1 },
  { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', kind: 'saving', icon: 'piggy-bank', tint: 'xls', opening: 50000, startDate: 'Mar 12, 2025', startTh: '12 มี.ค. 2025', sort: 2 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', kind: 'mf', icon: 'trending-up', tint: 'xls', opening: 82400, startDate: 'Apr 1, 2024', startTh: '1 เม.ย. 2024', sort: 3 },
  { name: 'RMF Mutual Fund', th: 'กองทุน RMF', kind: 'mf', icon: 'pie-chart', tint: 'pdf', opening: 32000, startDate: 'Jan 1, 2024', startTh: '1 ม.ค. 2024', sort: 4 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', kind: 'pf', icon: 'briefcase', tint: 'folder', opening: 48500, startDate: 'Jun 1, 2022', startTh: '1 มิ.ย. 2022', sort: 5 },
  { name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', kind: 'stock', icon: 'bar-chart-3', tint: 'pdf', opening: 28000, startDate: 'Aug 14, 2024', startTh: '14 ส.ค. 2024', sort: 6 },
  { name: 'US ETF portfolio', th: 'พอร์ตหุ้นต่างประเทศ', kind: 'stock', icon: 'globe', tint: 'image', opening: 18000, startDate: 'Nov 1, 2024', startTh: '1 พ.ย. 2024', sort: 7 },
  { name: 'Gold savings', th: 'ออมทอง', kind: 'gold', icon: 'coins', tint: 'image', opening: 15000, startDate: 'Jan 1, 2025', startTh: '1 ม.ค. 2025', sort: 8 },
  { name: 'Government bond', th: 'พันธบัตรรัฐบาล', kind: 'bond', icon: 'landmark', tint: 'doc', opening: 100000, startDate: 'Feb 1, 2023', startTh: '1 ก.พ. 2023', sort: 9 },
];

export const incomeCategories: Prisma.IncomeCategoryCreateManyInput[] = [
  { name: 'Monthly salary', th: 'เงินเดือน', sub: 'main', icon: 'briefcase', tint: 'xls', sort: 1 },
  { name: 'Year-end bonus', th: 'โบนัสประจำปี', sub: 'main', icon: 'gift', tint: 'xls', sort: 2 },
  { name: 'Overtime pay', th: 'ค่าล่วงเวลา', sub: 'main', icon: 'clock-3', tint: 'xls', sort: 3 },
  { name: 'Freelance work', th: 'รับงานฟรีแลนซ์', sub: 'side', icon: 'pen-tool', tint: 'doc', sort: 4 },
  { name: 'Online shop sales', th: 'ขายของออนไลน์', sub: 'side', icon: 'shopping-bag', tint: 'folder', sort: 5 },
  { name: 'Tutoring', th: 'สอนพิเศษ', sub: 'side', icon: 'book-open', tint: 'doc', sort: 6 },
  { name: 'Stock dividends', th: 'เงินปันผลหุ้น', sub: 'passive', icon: 'trending-up', tint: 'pdf', sort: 7 },
  { name: 'Mutual fund yield', th: 'ผลตอบแทนกองทุน', sub: 'passive', icon: 'pie-chart', tint: 'pdf', sort: 8 },
  { name: 'Rental income', th: 'ค่าเช่า', sub: 'passive', icon: 'house', tint: 'folder', sort: 9 },
];

export const planItems: Prisma.PlanItemCreateManyInput[] = [
  { type: 'income', name: 'Monthly salary', th: 'เงินเดือน', icon: 'briefcase', tint: 'xls', planned: 60000, actual: 62000, month: MONTH, sort: 1 },
  { type: 'income', name: 'Year-end bonus', th: 'โบนัสประจำปี', icon: 'gift', tint: 'xls', planned: 0, actual: 0, month: MONTH, sort: 2 },
  { type: 'income', name: 'Freelance work', th: 'รับงานฟรีแลนซ์', icon: 'pen-tool', tint: 'doc', planned: 5000, actual: 3200, month: MONTH, sort: 3 },
  { type: 'income', name: 'Stock dividends', th: 'เงินปันผลหุ้น', icon: 'trending-up', tint: 'pdf', planned: 1500, actual: 1820, month: MONTH, sort: 4 },
  { type: 'income', name: 'Other', th: 'อื่น ๆ', icon: 'plus', tint: 'folder', planned: 0, actual: 0, month: MONTH, sort: 5 },
  { type: 'expense', name: 'Food & Dining', th: 'ค่าอาหาร', cat: 'food', sub: 'need', planned: 5000, actual: 4200, month: MONTH, sort: 1 },
  { type: 'expense', name: 'Transport', th: 'ค่าเดินทาง', cat: 'transport', sub: 'need', planned: 2500, actual: 1800, month: MONTH, sort: 2 },
  { type: 'expense', name: 'Bills', th: 'ค่าน้ำ ค่าไฟ บิล', cat: 'bills', sub: 'need', planned: 3500, actual: 3200, month: MONTH, sort: 3 },
  { type: 'expense', name: 'Health', th: 'สุขภาพ', cat: 'health', sub: 'need', planned: 1500, actual: 1100, month: MONTH, sort: 4 },
  { type: 'expense', name: 'Shopping', th: 'ช้อปปิ้ง', cat: 'shopping', sub: 'want', planned: 5000, actual: 6500, month: MONTH, sort: 5 },
  { type: 'expense', name: 'Entertainment', th: 'บันเทิง', cat: 'fun', sub: 'want', planned: 1500, actual: 900, month: MONTH, sort: 6 },
  { type: 'savings', name: 'Emergency fund', th: 'เงินสำรองฉุกเฉิน', icon: 'shield-check', tint: 'doc', planned: 8000, actual: 8000, month: MONTH, sort: 1 },
  { type: 'savings', name: 'Stock portfolio', th: 'พอร์ตหุ้น', icon: 'trending-up', tint: 'xls', planned: 5000, actual: 5500, month: MONTH, sort: 2 },
  { type: 'savings', name: 'Retirement', th: 'เงินเพื่อเกษียณ', icon: 'tent-tree', tint: 'folder', planned: 4500, actual: 4500, month: MONTH, sort: 3 },
  { type: 'savings', name: 'Japan trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', tint: 'image', planned: 6000, actual: 4000, month: MONTH, sort: 4 },
  { type: 'savings', name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', tint: 'pdf', planned: 3000, actual: 3000, month: MONTH, sort: 5 },
];

export const assetSnapshots: Prisma.AssetSnapshotCreateManyInput[] = [
  { name: 'Kasikorn Savings', th: 'ออมทรัพย์ กสิกร', group: 'bank', icon: 'landmark', tint: 'doc', prev: 122100, curr: 128400, month: MONTH, sort: 1 },
  { name: 'SCB Current', th: 'กระแสรายวัน SCB', group: 'bank', icon: 'landmark', tint: 'xls', prev: 41200, curr: 42580, month: MONTH, sort: 2 },
  { name: 'Cash Wallet', th: 'เงินสด', group: 'bank', icon: 'banknote', tint: 'folder', prev: 3500, curr: 3200, month: MONTH, sort: 3 },
  { name: 'TrueMoney', th: 'TrueMoney', group: 'bank', icon: 'wallet', tint: 'image', prev: 1200, curr: 1850, month: MONTH, sort: 4 },
  { name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', group: 'savings', icon: 'piggy-bank', tint: 'doc', prev: 34800, curr: 35000, month: MONTH, sort: 5 },
  { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', group: 'savings', icon: 'piggy-bank', tint: 'xls', prev: 49500, curr: 50000, month: MONTH, sort: 6 },
  { name: 'SSF Mutual Fund', th: 'กองทุน SSF', group: 'invest', icon: 'trending-up', tint: 'xls', prev: 80100, curr: 82400, month: MONTH, sort: 7 },
  { name: 'RMF Mutual Fund', th: 'กองทุน RMF', group: 'invest', icon: 'pie-chart', tint: 'pdf', prev: 31200, curr: 32000, month: MONTH, sort: 8 },
  { name: 'Provident Fund', th: 'กองทุนสำรองเลี้ยงชีพ', group: 'invest', icon: 'briefcase', tint: 'folder', prev: 47200, curr: 48500, month: MONTH, sort: 9 },
  { name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', group: 'invest', icon: 'bar-chart-3', tint: 'pdf', prev: 30100, curr: 28000, month: MONTH, sort: 10 },
  { name: 'US ETF', th: 'พอร์ตหุ้นต่างประเทศ', group: 'invest', icon: 'globe', tint: 'image', prev: 16800, curr: 18000, month: MONTH, sort: 11 },
  { name: 'Gold savings', th: 'ออมทอง', group: 'invest', icon: 'coins', tint: 'image', prev: 14200, curr: 15000, month: MONTH, sort: 12 },
  { name: 'Motorcycle', th: 'รถมอเตอร์ไซค์', group: 'other', icon: 'bike', tint: 'doc', prev: 22500, curr: 22000, month: MONTH, sort: 13 },
  { name: 'Electronics', th: 'อุปกรณ์อิเล็กทรอนิกส์', group: 'other', icon: 'monitor', tint: 'image', prev: 35800, curr: 35000, month: MONTH, sort: 14 },
];

export const netWorthHistory: Prisma.NetWorthHistoryCreateManyInput[] = [
  { month: 'Jan', monthTh: 'ม.ค.', value: 295000, sort: 1 },
  { month: 'Feb', monthTh: 'ก.พ.', value: 312000, sort: 2 },
  { month: 'Mar', monthTh: 'มี.ค.', value: 328000, sort: 3 },
  { month: 'Apr', monthTh: 'เม.ย.', value: 446000, sort: 4 },
  { month: 'May', monthTh: 'พ.ค.', value: 510200, sort: 5 },
  { month: 'Jun', monthTh: 'มิ.ย.', value: 540850, sort: 6 },
];

export const monthlyCashflow: Prisma.MonthlyCashflowCreateManyInput[] = [
  { month: 'Jan', income: 60000, expense: 38000, sort: 1 },
  { month: 'Feb', income: 60000, expense: 42000, sort: 2 },
  { month: 'Mar', income: 62000, expense: 35000, sort: 3 },
  { month: 'Apr', income: 60000, expense: 47000, sort: 4 },
  { month: 'May', income: 62000, expense: 39000, sort: 5 },
  { month: 'Jun', income: 62000, expense: 17700, sort: 6 },
];

const DAY_SPEND: Record<number, number> = { 1: 149, 3: 419, 5: 12000, 7: 540, 10: 1240, 12: 280, 13: 1500, 14: 1470, 15: 1180, 17: 2219, 18: 553 };
export const daySpend: Prisma.DaySpendCreateManyInput[] = Object.entries(DAY_SPEND).map(([day, amount]) => ({ day: Number(day), amount, month: MONTH }));

type SetupGoalSeed = Omit<Prisma.SetupGoalCreateInput, 'channels'> & { channels: { name: string; th: string; pct: number }[] };
export const setupGoals: SetupGoalSeed[] = [
  {
    kind: 'emergency', name: 'Emergency fund', th: 'เงินสำรองเผื่อฉุกเฉิน 6 เดือน', icon: 'shield-check', tint: 'doc',
    startDate: 'Jan 2025', startTh: 'ม.ค. 2025', endDate: 'Dec 2025', endTh: 'ธ.ค. 2025', inflation: 4, target: 155287, opening: 25000, sort: 1,
    channels: [{ name: 'SCB Easy Savings', th: 'SCB Easy ออมทรัพย์', pct: 60 }, { name: 'TMRW High-yield', th: 'TMRW ดอกเบี้ยสูง', pct: 40 }],
  },
  {
    kind: 'stocks', name: 'Stock portfolio', th: 'พอร์ตหุ้น', icon: 'trending-up', tint: 'xls',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2030', endTh: 'ธ.ค. 2030', inflation: 4, target: 500000, opening: 28000, sort: 2,
    channels: [{ name: 'SET portfolio', th: 'พอร์ตหุ้นไทย', pct: 70 }, { name: 'US ETF', th: 'พอร์ตหุ้นต่างประเทศ', pct: 30 }],
  },
  {
    kind: 'retirement', name: 'Retirement', th: 'เงินเพื่อเกษียณ', icon: 'tent-tree', tint: 'folder',
    inflation: 4, opening: 80500, currentAge: 23, retireAge: 60, useUntilAge: 80, monthlyNeed: 10000, sort: 3,
    channels: [
      { name: 'Provident fund', th: 'กองทุนสำรองเลี้ยงชีพ', pct: 45 },
      { name: 'SSF', th: 'กองทุน SSF', pct: 30 },
      { name: 'RMF', th: 'กองทุน RMF', pct: 25 },
    ],
  },
  {
    kind: 'custom', name: 'Japan trip', th: 'เที่ยวญี่ปุ่น', icon: 'plane', tint: 'image',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2026', endTh: 'ธ.ค. 2026', inflation: 3, target: 120000, opening: 64000, sort: 4,
    channels: [{ name: 'TMB Travel Savings', th: 'TMB ออมทริป', pct: 100 }],
  },
  {
    kind: 'custom', name: 'New iPhone', th: 'ไอโฟนใหม่', icon: 'smartphone', tint: 'pdf',
    startDate: 'Mar 2026', startTh: 'มี.ค. 2026', endDate: 'Sep 2026', endTh: 'ก.ย. 2026', inflation: 0, target: 45000, opening: 28000, sort: 5,
    channels: [{ name: 'Cash Wallet', th: 'เงินสด', pct: 100 }],
  },
  {
    kind: 'custom', name: 'Buy a condo', th: 'ซื้อคอนโด', icon: 'house', tint: 'folder',
    startDate: 'Jan 2026', startTh: 'ม.ค. 2026', endDate: 'Dec 2032', endTh: 'ธ.ค. 2032', inflation: 4, target: 2500000, opening: 50000, sort: 6,
    channels: [{ name: 'High-yield savings', th: 'ออมดอกสูง', pct: 60 }, { name: 'Government bond', th: 'พันธบัตรรัฐบาล', pct: 40 }],
  },
];
