import { expect, reseed, test } from './fixtures';

// [path, text that must appear in English, text that must appear in Thai]. Read-only, so the database is seeded once.
const PAGES: [string, string, string][] = [
  ['/', 'Net worth', 'มูลค่าสุทธิ'],
  ['/', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/transactions', 'Monthly Salary', 'ธุรกรรม'],
  ['/transactions', 'Item (by activity)', 'รายการตามกิจกรรม'],
  ['/transactions/1', 'Acme Co. payroll', 'บันทึก'],
  ['/bills', 'KTC Credit Card', 'บิลเดือนนี้'],
  ['/bills?view=calendar', 'Bills this month', 'ปฏิทิน'],
  ['/debts', 'KrungThai Personal', 'กรุงไทยใจป้ำ'],
  ['/debts?strategy=snowball', 'Pay smallest balance first', 'จ่ายยอดน้อยก่อน'],
  ['/debts/2', 'Reducing balance', 'ลดต้นลดดอก'],
  ['/debts/2?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
  ['/debts/plan', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/debts/plan?strategy=snowball&extra=2000', 'Interest saved', 'ประหยัดดอกเบี้ย'],
  ['/debts/plan?extra=-5', 'Debt service ratio', 'ภาระหนี้ต่อรายได้'],
  ['/debts/16', 'Payment history', 'ประวัติการชำระ'],
  ['/debts/16?tab=schedule', 'Total interest', 'ดอกเบี้ยรวม'],
  ['/networth', 'Net worth trend', 'แนวโน้มมูลค่าสุทธิ'],
  ['/networth?tab=liabilities', 'Student Loan', 'กยศ'],
  ['/budgets', 'Total budget', 'งบรวม'],
  ['/accounts', 'Kasikorn Savings', 'บัญชี'],
  ['/bills?month=2026-07', 'Apartment Rent', 'ค่าเช่าบ้าน'],
  ['/bills?month=garbage', 'Apartment Rent', 'ค่าเช่าบ้าน'],
  ['/goals', 'Japan Trip', 'เที่ยวญี่ปุ่น'],
  ['/plan?tab=monthly', 'Add plan item', 'เพิ่มรายการแผน'],
  ['/plan?tab=monthly&month=2025-01', 'Nothing planned here yet.', 'ยังไม่มีรายการในแผนนี้'],
  ['/plan?tab=monthly&month=garbage', 'Income plan', 'แผนรายรับ'],
  ['/reports', 'Central Ladprao', 'ร้านค้ายอดนิยม'],
  ['/plan', 'Income plan', 'แผนรายรับ'],
  ['/plan?tab=summary', 'Net variance', 'ผลต่างรวม'],
  ['/plan?tab=assets', 'Last updated', 'อัพเดตล่าสุด'],
  ['/tax', 'Estimated tax', 'ภาษีที่ต้องจ่ายทั้งปี'],
  ['/tax', 'Estimate only, not tax advice', 'ไม่ใช่คำแนะนำทางภาษี'],
  ['/setup', 'Expense items', 'หมวด'],
  ['/setup', 'Debt payments', 'ชำระหนี้สิน'],
  ['/setup?tab=goals', 'Retirement', 'เกษียณ'],
  ['/settings', 'Preferences', 'การตั้งค่า'],
];

test.use({ reseedFirst: false });
test.beforeAll(() => reseed());

for (const [path, en, th] of PAGES) {
  test(`${path} shows "${en}" in English and Thai without errors`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('body')).toContainText(en);
    await context.addCookies([{ name: 'cfk-lang', value: 'th', url: 'http://localhost:3210' }]);
    await page.goto(path);
    await expect(page.locator('body')).toContainText(th);
    expect(errors).toEqual([]);
  });
}

test('/tax says unsaved figures are defaults and hides owe/refund until saved', async ({ page, context }) => {
  await context.addCookies([{ name: 'cfk-year', value: '2028', url: 'http://localhost:3210' }]);
  await page.goto('/tax');
  await expect(page.locator('body')).toContainText('Not saved yet');
  await expect(page.locator('body')).not.toContainText('You may owe');
});

test('falls back to English for a garbage language cookie', async ({ page, context }) => {
  await context.addCookies([{ name: 'cfk-lang', value: '<script>', url: 'http://localhost:3210' }]);
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('body')).toContainText('Dashboard');
});
