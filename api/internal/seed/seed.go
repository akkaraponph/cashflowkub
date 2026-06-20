// Package seed populates the database with the canonical CashflowKub demo data
// lifted verbatim from the design comp (CashflowKub App.dc.html).
package seed

import (
	"log"
	"time"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/clock"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"gorm.io/gorm"
)

func d(s string) time.Time {
	t, err := time.Parse("Jan 2, 2006", s)
	if err != nil {
		panic(err)
	}
	return t
}

// Run seeds all tables. It is idempotent: every table is truncated first so
// re-running produces the same canonical dataset.
func Run(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// Clear in FK-safe order.
		tables := []any{
			&model.SetupGoalChannel{}, &model.SetupGoal{}, &model.DaySpend{},
			&model.MonthlyCashflow{}, &model.NetWorthHistory{}, &model.AssetSnapshot{},
			&model.PlanItem{}, &model.IncomeCategory{}, &model.Channel{}, &model.Bill{},
			&model.Asset{}, &model.Debt{}, &model.Goal{}, &model.Budget{},
			&model.Transaction{}, &model.Category{}, &model.Account{},
		}
		for _, t := range tables {
			if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Unscoped().Delete(t).Error; err != nil {
				return err
			}
		}

		if err := tx.Create(&categories).Error; err != nil {
			return err
		}
		if err := tx.Create(&accounts).Error; err != nil {
			return err
		}
		if err := tx.Create(&transactions).Error; err != nil {
			return err
		}
		if err := tx.Create(&budgets).Error; err != nil {
			return err
		}
		if err := tx.Create(&goals).Error; err != nil {
			return err
		}
		if err := tx.Create(&debts).Error; err != nil {
			return err
		}
		if err := tx.Create(&assets).Error; err != nil {
			return err
		}
		if err := tx.Create(&bills).Error; err != nil {
			return err
		}
		if err := tx.Create(&channels).Error; err != nil {
			return err
		}
		if err := tx.Create(&incomeCats).Error; err != nil {
			return err
		}
		if err := tx.Create(&planItems).Error; err != nil {
			return err
		}
		if err := tx.Create(&assetSnapshots).Error; err != nil {
			return err
		}
		if err := tx.Create(&netWorthHist).Error; err != nil {
			return err
		}
		if err := tx.Create(&monthlyCashflow).Error; err != nil {
			return err
		}
		if err := tx.Create(&daySpend).Error; err != nil {
			return err
		}
		if err := tx.Create(&setupGoals).Error; err != nil { // cascades channels
			return err
		}

		log.Println("seed: complete")
		return nil
	})
}

var categories = []model.Category{
	{Key: "food", Label: "Food & Dining", Th: "อาหาร", Short: "Food", Icon: "utensils", Tint: "folder", Type: "expense", Sub: "need", Sort: 1},
	{Key: "transport", Label: "Transport", Th: "เดินทาง", Short: "Transit", Icon: "car", Tint: "doc", Type: "expense", Sub: "need", Sort: 2},
	{Key: "shopping", Label: "Shopping", Th: "ช้อปปิ้ง", Short: "Shop", Icon: "shopping-bag", Tint: "image", Type: "expense", Sub: "want", Sort: 3},
	{Key: "bills", Label: "Bills", Th: "บิล", Short: "Bills", Icon: "receipt", Tint: "pdf", Type: "expense", Sub: "need", Sort: 4},
	{Key: "fun", Label: "Entertainment", Th: "บันเทิง", Short: "Fun", Icon: "clapperboard", Tint: "video", Type: "expense", Sub: "want", Sort: 5},
	{Key: "health", Label: "Health", Th: "สุขภาพ", Short: "Health", Icon: "heart-pulse", Tint: "xls", Type: "expense", Sub: "need", Sort: 6},
	{Key: "income", Label: "Income", Th: "รายรับ", Short: "Income", Icon: "arrow-down-left", Tint: "xls", Type: "income", Sub: "", Sort: 7},
}

var accounts = []model.Account{
	{Name: "Kasikorn Savings", Sub: "KBank ••4821", Balance: 128400, Icon: "landmark", Tint: "doc", Kind: "bank", StartDate: "Mar 1, 2019", StartTh: "1 มี.ค. 2019", Sort: 1},
	{Name: "SCB Current", Sub: "SCB ••0192", Balance: 42580, Icon: "landmark", Tint: "xls", Kind: "bank", StartDate: "Jul 12, 2020", StartTh: "12 ก.ค. 2020", Sort: 2},
	{Name: "Cash Wallet", Sub: "เงินสด", Balance: 3200, Icon: "banknote", Tint: "folder", Kind: "cash", StartDate: "Always", StartTh: "ตลอด", Sort: 3},
	{Name: "TrueMoney", Sub: "e-Wallet", Balance: 1850, Icon: "wallet", Tint: "image", Kind: "ewallet", StartDate: "Sep 4, 2021", StartTh: "4 ก.ย. 2021", Sort: 4},
	{Name: "KTC Credit", Sub: "••7733", Balance: -18200, Icon: "credit-card", Tint: "pdf", Kind: "credit", StartDate: "May 22, 2022", StartTh: "22 พ.ค. 2022", Sort: 5},
}

var transactions = []model.Transaction{
	{Name: "Monthly Salary", CatKey: "income", Account: "Kasikorn Savings", Amount: 62000, Date: d("Jun 18, 2026"), Note: "Acme Co. payroll"},
	{Name: "Starbucks", CatKey: "food", Account: "SCB Current", Amount: -185, Date: d("Jun 18, 2026"), Note: "Latte + croissant"},
	{Name: "Grab", CatKey: "transport", Account: "TrueMoney", Amount: -120, Date: d("Jun 18, 2026"), Note: "Ride to office"},
	{Name: "7-Eleven", CatKey: "food", Account: "Cash Wallet", Amount: -248, Date: d("Jun 17, 2026"), Note: "Snacks"},
	{Name: "Netflix", CatKey: "fun", Account: "KTC Credit", Amount: -419, Date: d("Jun 17, 2026"), Note: "Premium plan"},
	{Name: "PEA Electricity", CatKey: "bills", Account: "SCB Current", Amount: -1240, Date: d("Jun 17, 2026"), Note: "June bill"},
	{Name: "Central Ladprao", CatKey: "shopping", Account: "KTC Credit", Amount: -2890, Date: d("Jun 15, 2026"), Note: "Clothes"},
	{Name: "BTS Rabbit top-up", CatKey: "transport", Account: "TrueMoney", Amount: -400, Date: d("Jun 15, 2026"), Note: "Commute card"},
	{Name: "Boots Pharmacy", CatKey: "health", Account: "SCB Current", Amount: -560, Date: d("Jun 15, 2026"), Note: "Vitamins"},
	{Name: "Lazada", CatKey: "shopping", Account: "KTC Credit", Amount: -1150, Date: d("Jun 14, 2026"), Note: "Phone case"},
	{Name: "Foodpanda", CatKey: "food", Account: "SCB Current", Amount: -320, Date: d("Jun 14, 2026"), Note: "Dinner"},
	{Name: "Fitness First", CatKey: "health", Account: "SCB Current", Amount: -1500, Date: d("Jun 13, 2026"), Note: "Membership"},
}

var budgets = []model.Budget{
	{CatKey: "shopping", Spent: 6500, Limit: 5000, Sort: 1},
	{CatKey: "food", Spent: 4200, Limit: 5000, Sort: 2},
	{CatKey: "bills", Spent: 3200, Limit: 3500, Sort: 3},
	{CatKey: "transport", Spent: 1800, Limit: 2500, Sort: 4},
	{CatKey: "health", Spent: 1100, Limit: 1500, Sort: 5},
	{CatKey: "fun", Spent: 900, Limit: 1500, Sort: 6},
}

var goals = []model.Goal{
	{Name: "Emergency Fund", Th: "เงินสำรองฉุกเฉิน", Icon: "shield", Saved: 145000, Target: 200000, Monthly: 8000, By: "Ongoing", Sort: 1},
	{Name: "Japan Trip", Th: "เที่ยวญี่ปุ่น", Icon: "plane", Saved: 64000, Target: 120000, Monthly: 6000, By: "Dec 2026", Sort: 2},
	{Name: "New iPhone", Th: "ไอโฟนใหม่", Icon: "smartphone", Saved: 28000, Target: 45000, Monthly: 3000, By: "Sep 2026", Sort: 3},
}

var debts = []model.Debt{
	{Name: "Student Loan (กยศ)", Th: "กยศ", Icon: "graduation-cap", Tint: "doc", Original: 186650, Paid: 8275, Apr: 0, Monthly: 3889, Calc: "flat", Payoff: "May 2030", PayoffTh: "พ.ค. 2030", MonthsLeft: 46, Sort: 1},
	{Name: "KrungThai Personal", Th: "กรุงไทยใจป้ำ", Icon: "landmark", Tint: "pdf", Original: 70000, Paid: 24300, Apr: 25, Monthly: 2783, Calc: "reducing", Payoff: "Nov 2028", PayoffTh: "พ.ย. 2028", MonthsLeft: 28, Sort: 2},
	{Name: "Kbank Nano 3", Th: "Kbank Nano 3", Icon: "credit-card", Tint: "pdf", Original: 12000, Paid: 4570, Apr: 33, Monthly: 1523, Calc: "reducing", Payoff: "Mar 2027", PayoffTh: "มี.ค. 2027", MonthsLeft: 6, Revolving: true, Sort: 3},
	{Name: "SPEC 3 Personal", Th: "SPEC 3", Icon: "receipt", Tint: "pdf", Original: 9593, Paid: 5300, Apr: 33, Monthly: 1607, Calc: "reducing", Payoff: "Dec 2026", PayoffTh: "ธ.ค. 2026", MonthsLeft: 3, Sort: 4},
	{Name: "Kbank Nano 2", Th: "Kbank Nano 2", Icon: "credit-card", Tint: "pdf", Original: 8000, Paid: 5400, Apr: 33, Monthly: 1016, Calc: "reducing", Payoff: "Nov 2026", PayoffTh: "พ.ย. 2026", MonthsLeft: 3, Revolving: true, Sort: 5},
	{Name: "SPEC 4", Th: "SPEC 4", Icon: "receipt", Tint: "doc", Original: 7789, Paid: 7789, Apr: 33, Monthly: 948, Calc: "reducing", Payoff: "Jul 2026", PayoffTh: "ก.ค. 2026", MonthsLeft: 0, Done: true, Sort: 6},
	{Name: "iPhone 16 / PQ", Th: "ผ่อน iPhone 16 กับ PQ", Icon: "smartphone", Tint: "image", Original: 30580, Paid: 30580, Apr: 0, Monthly: 3058, Calc: "flat", Payoff: "Mar 2026", PayoffTh: "มี.ค. 2026", MonthsLeft: 0, Done: true, Sort: 7},
	{Name: "Motorcycle", Th: "รถมอเตอร์ไซค์", Icon: "bike", Tint: "doc", Original: 14885, Paid: 14885, Apr: 0, Monthly: 2977, Calc: "flat", Payoff: "Apr 2025", PayoffTh: "เม.ย. 2025", MonthsLeft: 0, Done: true, Sort: 8},
	{Name: "iPhone Piggybank", Th: "ยืมกระปุก IPHONE", Icon: "piggy-bank", Tint: "folder", Original: 15800, Paid: 15800, Apr: 0, Monthly: 7900, Calc: "flat", Payoff: "Feb 2025", PayoffTh: "ก.พ. 2025", MonthsLeft: 0, Done: true, Sort: 9},
	{Name: "Kbank Nano 1", Th: "Kbank Nano", Icon: "credit-card", Tint: "pdf", Original: 5000, Paid: 5000, Apr: 33, Monthly: 635, Calc: "reducing", Payoff: "Jul 2025", PayoffTh: "ก.ค. 2025", MonthsLeft: 0, Done: true, Sort: 10},
	{Name: "SPEC 1", Th: "SPEC 1", Icon: "receipt", Tint: "pdf", Original: 4032, Paid: 4032, Apr: 31.4, Monthly: 898, Calc: "reducing", Payoff: "Sep 2025", PayoffTh: "ก.ย. 2025", MonthsLeft: 0, Done: true, Sort: 11},
	{Name: "SPEC 2", Th: "SPEC 2", Icon: "receipt", Tint: "pdf", Original: 5514, Paid: 5514, Apr: 33, Monthly: 915, Calc: "reducing", Payoff: "Aug 2025", PayoffTh: "ส.ค. 2025", MonthsLeft: 0, Done: true, Sort: 12},
	{Name: "Water Heater / PQ", Th: "เครื่องทำน้ำอุ่น พี่คิว", Icon: "shower-head", Tint: "image", Original: 1886, Paid: 1886, Apr: 0, Monthly: 629, Calc: "flat", Payoff: "Mar 2025", PayoffTh: "มี.ค. 2025", MonthsLeft: 0, Done: true, Sort: 13},
	{Name: "Desk & Keyboard", Th: "โต๊ะ และ คีย์บอร์ด", Icon: "monitor", Tint: "doc", Original: 2137, Paid: 2137, Apr: 0, Monthly: 712, Calc: "flat", Payoff: "Jul 2025", PayoffTh: "ก.ค. 2025", MonthsLeft: 0, Done: true, Sort: 14},
}

var assets = []model.Asset{
	{Name: "Kasikorn Savings", Th: "ออมทรัพย์ กสิกร", Icon: "landmark", Tint: "doc", Value: 128400, Sort: 1},
	{Name: "SCB Current", Th: "กระแสรายวัน SCB", Icon: "landmark", Tint: "xls", Value: 42580, Sort: 2},
	{Name: "Cash Wallet", Th: "เงินสด", Icon: "banknote", Tint: "folder", Value: 3200, Sort: 3},
	{Name: "TrueMoney Wallet", Th: "TrueMoney", Icon: "wallet", Tint: "image", Value: 1850, Sort: 4},
	{Name: "SSF Mutual Fund", Th: "กองทุน SSF", Icon: "trending-up", Tint: "xls", Value: 82400, Sort: 5},
	{Name: "Provident Fund", Th: "กองทุนสำรองเลี้ยงชีพ", Icon: "piggy-bank", Tint: "xls", Value: 48500, Sort: 6},
	{Name: "Motorcycle", Th: "รถมอเตอร์ไซค์", Icon: "bike", Tint: "doc", Value: 22000, Sort: 7},
	{Name: "Electronics & Gear", Th: "อุปกรณ์อิเล็กทรอนิกส์", Icon: "monitor", Tint: "image", Value: 35000, Sort: 8},
}

var bills = []model.Bill{
	{Name: "Spotify Family", Th: "Spotify Family", Icon: "music", Tint: "image", Amount: 149, DueDay: 1, Paid: true, Freq: "monthly", CatKey: "fun", Sort: 1},
	{Name: "Netflix Premium", Th: "Netflix Premium", Icon: "clapperboard", Tint: "video", Amount: 419, DueDay: 3, Paid: true, Freq: "monthly", CatKey: "fun", Sort: 2},
	{Name: "Apartment Rent", Th: "ค่าเช่าบ้าน", Icon: "house", Tint: "folder", Amount: 12000, DueDay: 5, Paid: true, Freq: "monthly", CatKey: "bills", Sort: 3},
	{Name: "PEA Electricity", Th: "ค่าไฟ PEA", Icon: "zap", Tint: "pdf", Amount: 1240, DueDay: 10, Paid: true, Freq: "monthly", CatKey: "bills", Sort: 4},
	{Name: "AIS Fiber Internet", Th: "AIS Fiber อินเทอร์เน็ต", Icon: "wifi", Tint: "doc", Amount: 590, DueDay: 15, Paid: true, Freq: "monthly", CatKey: "bills", Sort: 5},
	{Name: "KTC Credit Card", Th: "บัตรเครดิต KTC", Icon: "credit-card", Tint: "pdf", Amount: 2500, DueDay: 16, Paid: false, Freq: "monthly", CatKey: "debt", Sort: 6},
	{Name: "MEA Water", Th: "ค่าน้ำประปา", Icon: "droplet", Tint: "doc", Amount: 180, DueDay: 20, Paid: false, Freq: "monthly", CatKey: "bills", Sort: 7},
	{Name: "AIS Mobile", Th: "AIS มือถือ", Icon: "smartphone", Tint: "image", Amount: 399, DueDay: 20, Paid: false, Freq: "monthly", CatKey: "bills", Sort: 8},
	{Name: "Kbank Nano 3", Th: "Kbank Nano 3", Icon: "credit-card", Tint: "pdf", Amount: 1523, DueDay: 25, Paid: false, Freq: "monthly", CatKey: "debt", Sort: 9},
	{Name: "KrungThai Personal", Th: "กรุงไทยใจป้ำ", Icon: "landmark", Tint: "pdf", Amount: 2783, DueDay: 25, Paid: false, Freq: "monthly", CatKey: "debt", Sort: 10},
	{Name: "Student Loan (กยศ)", Th: "กยศ", Icon: "graduation-cap", Tint: "doc", Amount: 3889, DueDay: 28, Paid: false, Freq: "monthly", CatKey: "debt", Sort: 11},
	{Name: "AIA Life Insurance", Th: "ประกันชีวิต AIA", Icon: "shield", Tint: "xls", Amount: 1850, DueDay: 30, Paid: false, Freq: "monthly", CatKey: "bills", Sort: 12},
	{Name: "iCloud+ 200GB", Th: "iCloud+ 200GB", Icon: "cloud", Tint: "image", Amount: 99, DueDay: 30, Paid: false, Freq: "monthly", CatKey: "fun", Sort: 13},
}

var channels = []model.Channel{
	{Name: "SCB Easy Savings", Th: "SCB Easy ออมทรัพย์", Kind: "saving", Icon: "piggy-bank", Tint: "doc", Opening: 35000, StartDate: "Jan 1, 2025", StartTh: "1 ม.ค. 2025", Sort: 1},
	{Name: "TMRW High-yield", Th: "TMRW ดอกเบี้ยสูง", Kind: "saving", Icon: "piggy-bank", Tint: "xls", Opening: 50000, StartDate: "Mar 12, 2025", StartTh: "12 มี.ค. 2025", Sort: 2},
	{Name: "SSF Mutual Fund", Th: "กองทุน SSF", Kind: "mf", Icon: "trending-up", Tint: "xls", Opening: 82400, StartDate: "Apr 1, 2024", StartTh: "1 เม.ย. 2024", Sort: 3},
	{Name: "RMF Mutual Fund", Th: "กองทุน RMF", Kind: "mf", Icon: "pie-chart", Tint: "pdf", Opening: 32000, StartDate: "Jan 1, 2024", StartTh: "1 ม.ค. 2024", Sort: 4},
	{Name: "Provident Fund", Th: "กองทุนสำรองเลี้ยงชีพ", Kind: "pf", Icon: "briefcase", Tint: "folder", Opening: 48500, StartDate: "Jun 1, 2022", StartTh: "1 มิ.ย. 2022", Sort: 5},
	{Name: "SET portfolio", Th: "พอร์ตหุ้นไทย", Kind: "stock", Icon: "bar-chart-3", Tint: "pdf", Opening: 28000, StartDate: "Aug 14, 2024", StartTh: "14 ส.ค. 2024", Sort: 6},
	{Name: "US ETF portfolio", Th: "พอร์ตหุ้นต่างประเทศ", Kind: "stock", Icon: "globe", Tint: "image", Opening: 18000, StartDate: "Nov 1, 2024", StartTh: "1 พ.ย. 2024", Sort: 7},
	{Name: "Gold savings", Th: "ออมทอง", Kind: "gold", Icon: "coins", Tint: "image", Opening: 15000, StartDate: "Jan 1, 2025", StartTh: "1 ม.ค. 2025", Sort: 8},
	{Name: "Government bond", Th: "พันธบัตรรัฐบาล", Kind: "bond", Icon: "landmark", Tint: "doc", Opening: 100000, StartDate: "Feb 1, 2023", StartTh: "1 ก.พ. 2023", Sort: 9},
}

var incomeCats = []model.IncomeCategory{
	{Name: "Monthly salary", Th: "เงินเดือน", Sub: "main", Icon: "briefcase", Tint: "xls", Sort: 1},
	{Name: "Year-end bonus", Th: "โบนัสประจำปี", Sub: "main", Icon: "gift", Tint: "xls", Sort: 2},
	{Name: "Overtime pay", Th: "ค่าล่วงเวลา", Sub: "main", Icon: "clock-3", Tint: "xls", Sort: 3},
	{Name: "Freelance work", Th: "รับงานฟรีแลนซ์", Sub: "side", Icon: "pen-tool", Tint: "doc", Sort: 4},
	{Name: "Online shop sales", Th: "ขายของออนไลน์", Sub: "side", Icon: "shopping-bag", Tint: "folder", Sort: 5},
	{Name: "Tutoring", Th: "สอนพิเศษ", Sub: "side", Icon: "book-open", Tint: "doc", Sort: 6},
	{Name: "Stock dividends", Th: "เงินปันผลหุ้น", Sub: "passive", Icon: "trending-up", Tint: "pdf", Sort: 7},
	{Name: "Mutual fund yield", Th: "ผลตอบแทนกองทุน", Sub: "passive", Icon: "pie-chart", Tint: "pdf", Sort: 8},
	{Name: "Rental income", Th: "ค่าเช่า", Sub: "passive", Icon: "house", Tint: "folder", Sort: 9},
}

var planItems = []model.PlanItem{
	// Income plan
	{Type: "income", Name: "Monthly salary", Th: "เงินเดือน", Icon: "briefcase", Tint: "xls", Planned: 60000, Actual: 62000, Month: clock.CurrentMonth, Sort: 1},
	{Type: "income", Name: "Year-end bonus", Th: "โบนัสประจำปี", Icon: "gift", Tint: "xls", Planned: 0, Actual: 0, Month: clock.CurrentMonth, Sort: 2},
	{Type: "income", Name: "Freelance work", Th: "รับงานฟรีแลนซ์", Icon: "pen-tool", Tint: "doc", Planned: 5000, Actual: 3200, Month: clock.CurrentMonth, Sort: 3},
	{Type: "income", Name: "Stock dividends", Th: "เงินปันผลหุ้น", Icon: "trending-up", Tint: "pdf", Planned: 1500, Actual: 1820, Month: clock.CurrentMonth, Sort: 4},
	{Type: "income", Name: "Other", Th: "อื่น ๆ", Icon: "plus", Tint: "folder", Planned: 0, Actual: 0, Month: clock.CurrentMonth, Sort: 5},
	// Expense plan
	{Type: "expense", Name: "Food & Dining", Th: "ค่าอาหาร", CatKey: "food", Sub: "need", Planned: 5000, Actual: 4200, Month: clock.CurrentMonth, Sort: 1},
	{Type: "expense", Name: "Transport", Th: "ค่าเดินทาง", CatKey: "transport", Sub: "need", Planned: 2500, Actual: 1800, Month: clock.CurrentMonth, Sort: 2},
	{Type: "expense", Name: "Bills", Th: "ค่าน้ำ ค่าไฟ บิล", CatKey: "bills", Sub: "need", Planned: 3500, Actual: 3200, Month: clock.CurrentMonth, Sort: 3},
	{Type: "expense", Name: "Health", Th: "สุขภาพ", CatKey: "health", Sub: "need", Planned: 1500, Actual: 1100, Month: clock.CurrentMonth, Sort: 4},
	{Type: "expense", Name: "Shopping", Th: "ช้อปปิ้ง", CatKey: "shopping", Sub: "want", Planned: 5000, Actual: 6500, Month: clock.CurrentMonth, Sort: 5},
	{Type: "expense", Name: "Entertainment", Th: "บันเทิง", CatKey: "fun", Sub: "want", Planned: 1500, Actual: 900, Month: clock.CurrentMonth, Sort: 6},
	// Savings plan
	{Type: "savings", Name: "Emergency fund", Th: "เงินสำรองฉุกเฉิน", Icon: "shield-check", Tint: "doc", Planned: 8000, Actual: 8000, Month: clock.CurrentMonth, Sort: 1},
	{Type: "savings", Name: "Stock portfolio", Th: "พอร์ตหุ้น", Icon: "trending-up", Tint: "xls", Planned: 5000, Actual: 5500, Month: clock.CurrentMonth, Sort: 2},
	{Type: "savings", Name: "Retirement", Th: "เงินเพื่อเกษียณ", Icon: "tent-tree", Tint: "folder", Planned: 4500, Actual: 4500, Month: clock.CurrentMonth, Sort: 3},
	{Type: "savings", Name: "Japan trip", Th: "เที่ยวญี่ปุ่น", Icon: "plane", Tint: "image", Planned: 6000, Actual: 4000, Month: clock.CurrentMonth, Sort: 4},
	{Type: "savings", Name: "New iPhone", Th: "ไอโฟนใหม่", Icon: "smartphone", Tint: "pdf", Planned: 3000, Actual: 3000, Month: clock.CurrentMonth, Sort: 5},
}

var assetSnapshots = []model.AssetSnapshot{
	{Name: "Kasikorn Savings", Th: "ออมทรัพย์ กสิกร", Grp: "bank", Icon: "landmark", Tint: "doc", Prev: 122100, Curr: 128400, Month: clock.CurrentMonth, Sort: 1},
	{Name: "SCB Current", Th: "กระแสรายวัน SCB", Grp: "bank", Icon: "landmark", Tint: "xls", Prev: 41200, Curr: 42580, Month: clock.CurrentMonth, Sort: 2},
	{Name: "Cash Wallet", Th: "เงินสด", Grp: "bank", Icon: "banknote", Tint: "folder", Prev: 3500, Curr: 3200, Month: clock.CurrentMonth, Sort: 3},
	{Name: "TrueMoney", Th: "TrueMoney", Grp: "bank", Icon: "wallet", Tint: "image", Prev: 1200, Curr: 1850, Month: clock.CurrentMonth, Sort: 4},
	{Name: "SCB Easy Savings", Th: "SCB Easy ออมทรัพย์", Grp: "savings", Icon: "piggy-bank", Tint: "doc", Prev: 34800, Curr: 35000, Month: clock.CurrentMonth, Sort: 5},
	{Name: "TMRW High-yield", Th: "TMRW ดอกเบี้ยสูง", Grp: "savings", Icon: "piggy-bank", Tint: "xls", Prev: 49500, Curr: 50000, Month: clock.CurrentMonth, Sort: 6},
	{Name: "SSF Mutual Fund", Th: "กองทุน SSF", Grp: "invest", Icon: "trending-up", Tint: "xls", Prev: 80100, Curr: 82400, Month: clock.CurrentMonth, Sort: 7},
	{Name: "RMF Mutual Fund", Th: "กองทุน RMF", Grp: "invest", Icon: "pie-chart", Tint: "pdf", Prev: 31200, Curr: 32000, Month: clock.CurrentMonth, Sort: 8},
	{Name: "Provident Fund", Th: "กองทุนสำรองเลี้ยงชีพ", Grp: "invest", Icon: "briefcase", Tint: "folder", Prev: 47200, Curr: 48500, Month: clock.CurrentMonth, Sort: 9},
	{Name: "SET portfolio", Th: "พอร์ตหุ้นไทย", Grp: "invest", Icon: "bar-chart-3", Tint: "pdf", Prev: 30100, Curr: 28000, Month: clock.CurrentMonth, Sort: 10},
	{Name: "US ETF", Th: "พอร์ตหุ้นต่างประเทศ", Grp: "invest", Icon: "globe", Tint: "image", Prev: 16800, Curr: 18000, Month: clock.CurrentMonth, Sort: 11},
	{Name: "Gold savings", Th: "ออมทอง", Grp: "invest", Icon: "coins", Tint: "image", Prev: 14200, Curr: 15000, Month: clock.CurrentMonth, Sort: 12},
	{Name: "Motorcycle", Th: "รถมอเตอร์ไซค์", Grp: "other", Icon: "bike", Tint: "doc", Prev: 22500, Curr: 22000, Month: clock.CurrentMonth, Sort: 13},
	{Name: "Electronics", Th: "อุปกรณ์อิเล็กทรอนิกส์", Grp: "other", Icon: "monitor", Tint: "image", Prev: 35800, Curr: 35000, Month: clock.CurrentMonth, Sort: 14},
}

var netWorthHist = []model.NetWorthHistory{
	{Month: "Jan", MonthTh: "ม.ค.", Value: 295000, Sort: 1},
	{Month: "Feb", MonthTh: "ก.พ.", Value: 312000, Sort: 2},
	{Month: "Mar", MonthTh: "มี.ค.", Value: 328000, Sort: 3},
	{Month: "Apr", MonthTh: "เม.ย.", Value: 446000, Sort: 4},
	{Month: "May", MonthTh: "พ.ค.", Value: 510200, Sort: 5},
	{Month: "Jun", MonthTh: "มิ.ย.", Value: 540850, Sort: 6},
}

var monthlyCashflow = []model.MonthlyCashflow{
	{Month: "Jan", Income: 60000, Expense: 38000, Sort: 1},
	{Month: "Feb", Income: 60000, Expense: 42000, Sort: 2},
	{Month: "Mar", Income: 62000, Expense: 35000, Sort: 3},
	{Month: "Apr", Income: 60000, Expense: 47000, Sort: 4},
	{Month: "May", Income: 62000, Expense: 39000, Sort: 5},
	{Month: "Jun", Income: 62000, Expense: 17700, Sort: 6},
}

var daySpend = func() []model.DaySpend {
	raw := map[int]int64{1: 149, 3: 419, 5: 12000, 7: 540, 10: 1240, 12: 280, 13: 1500, 14: 1470, 15: 1180, 17: 2219, 18: 553}
	out := make([]model.DaySpend, 0, len(raw))
	for day, amt := range raw {
		out = append(out, model.DaySpend{Day: day, Amount: amt, Month: clock.CurrentMonth})
	}
	return out
}()

var setupGoals = []model.SetupGoal{
	{
		Kind: "emergency", Name: "Emergency fund", Th: "เงินสำรองเผื่อฉุกเฉิน 6 เดือน", Icon: "shield-check", Tint: "doc",
		StartDate: "Jan 2025", StartTh: "ม.ค. 2025", EndDate: "Dec 2025", EndTh: "ธ.ค. 2025", Inflation: 4, Target: 155287, Opening: 25000, Sort: 1,
		Channels: []model.SetupGoalChannel{
			{Name: "SCB Easy Savings", Th: "SCB Easy ออมทรัพย์", Pct: 60},
			{Name: "TMRW High-yield", Th: "TMRW ดอกเบี้ยสูง", Pct: 40},
		},
	},
	{
		Kind: "stocks", Name: "Stock portfolio", Th: "พอร์ตหุ้น", Icon: "trending-up", Tint: "xls",
		StartDate: "Jan 2026", StartTh: "ม.ค. 2026", EndDate: "Dec 2030", EndTh: "ธ.ค. 2030", Inflation: 4, Target: 500000, Opening: 28000, Sort: 2,
		Channels: []model.SetupGoalChannel{
			{Name: "SET portfolio", Th: "พอร์ตหุ้นไทย", Pct: 70},
			{Name: "US ETF", Th: "พอร์ตหุ้นต่างประเทศ", Pct: 30},
		},
	},
	{
		Kind: "retirement", Name: "Retirement", Th: "เงินเพื่อเกษียณ", Icon: "tent-tree", Tint: "folder",
		Inflation: 4, Opening: 80500, CurrentAge: 23, RetireAge: 60, UseUntilAge: 80, MonthlyNeed: 10000, Sort: 3,
		Channels: []model.SetupGoalChannel{
			{Name: "Provident fund", Th: "กองทุนสำรองเลี้ยงชีพ", Pct: 45},
			{Name: "SSF", Th: "กองทุน SSF", Pct: 30},
			{Name: "RMF", Th: "กองทุน RMF", Pct: 25},
		},
	},
	{
		Kind: "custom", Name: "Japan trip", Th: "เที่ยวญี่ปุ่น", Icon: "plane", Tint: "image",
		StartDate: "Jan 2026", StartTh: "ม.ค. 2026", EndDate: "Dec 2026", EndTh: "ธ.ค. 2026", Inflation: 3, Target: 120000, Opening: 64000, Sort: 4,
		Channels: []model.SetupGoalChannel{{Name: "TMB Travel Savings", Th: "TMB ออมทริป", Pct: 100}},
	},
	{
		Kind: "custom", Name: "New iPhone", Th: "ไอโฟนใหม่", Icon: "smartphone", Tint: "pdf",
		StartDate: "Mar 2026", StartTh: "มี.ค. 2026", EndDate: "Sep 2026", EndTh: "ก.ย. 2026", Inflation: 0, Target: 45000, Opening: 28000, Sort: 5,
		Channels: []model.SetupGoalChannel{{Name: "Cash Wallet", Th: "เงินสด", Pct: 100}},
	},
	{
		Kind: "custom", Name: "Buy a condo", Th: "ซื้อคอนโด", Icon: "house", Tint: "folder",
		StartDate: "Jan 2026", StartTh: "ม.ค. 2026", EndDate: "Dec 2032", EndTh: "ธ.ค. 2032", Inflation: 4, Target: 2500000, Opening: 50000, Sort: 6,
		Channels: []model.SetupGoalChannel{
			{Name: "High-yield savings", Th: "ออมดอกสูง", Pct: 60},
			{Name: "Government bond", Th: "พันธบัตรรัฐบาล", Pct: 40},
		},
	},
}
