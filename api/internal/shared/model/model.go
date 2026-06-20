// Package model defines the GORM-mapped entities for CashflowKub.
//
// It is the shared kernel: every domain reads these structs, which model the
// relational schema common to the whole app. Behaviour lives in the feature
// domains; this package holds data shapes only (Pure Logic — no I/O).
//
// Money is stored as whole Thai baht in int64 fields (the design never shows
// sub-baht precision). Bilingual strings carry an English value plus a `Th`
// (Thai) counterpart so the mobile client can switch language without a round
// trip. `Sort` columns preserve the deliberate ordering from the design.
package model

import "time"

// Account is a place money lives — bank, cash, e-wallet or credit line.
type Account struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `json:"name"`
	Sub       string    `json:"sub"`       // masked number / wallet descriptor
	Balance   int64     `json:"balance"`   // negative for credit balances owed
	Icon      string    `json:"icon"`      // lucide icon name
	Tint      string    `json:"tint"`      // file-type accent key (doc/xls/pdf/...)
	Kind      string    `json:"kind"`      // bank | cash | ewallet | credit
	StartDate string    `json:"startDate"` // English open date label
	StartTh   string    `json:"startTh"`   // Thai open date label
	Sort      int       `json:"sort"`
	CreatedAt time.Time `json:"-"`
	UpdatedAt time.Time `json:"-"`
}

// Category is a spending/earning bucket. `Key` is the stable slug used by
// transactions, budgets and the plan (e.g. "food", "income").
type Category struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Key   string `gorm:"uniqueIndex" json:"key"`
	Label string `json:"label"`
	Th    string `json:"th"`
	Short string `json:"short"`
	Icon  string `json:"icon"`
	Tint  string `json:"tint"`
	Type  string `json:"type"` // income | expense
	Sub   string `json:"sub"`  // need | want (expense classification)
	Sort  int    `json:"sort"`
}

// Transaction is a single money movement. Amount is signed: negative = expense,
// positive = income. The group label (Today/Yesterday/date) is derived at read
// time relative to the reference "today" so it stays correct as data grows.
type Transaction struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `json:"name"`
	CatKey    string    `gorm:"column:cat_key" json:"cat"`
	Account   string    `json:"acct"`
	Amount    int64     `json:"amount"`
	Date      time.Time `gorm:"type:date" json:"-"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"-"`
	UpdatedAt time.Time `json:"-"`
}

// Budget caps spending for a category in the current month.
type Budget struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	CatKey string `gorm:"column:cat_key" json:"cat"`
	Spent  int64  `json:"spent"`
	Limit  int64  `gorm:"column:limit_amt" json:"limit"`
	Sort   int    `json:"sort"`
}

// Goal is a savings target surfaced on the dashboard and Goals screen.
type Goal struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Name    string `json:"name"`
	Th      string `json:"th"`
	Icon    string `json:"icon"`
	Saved   int64  `json:"saved"`
	Target  int64  `json:"target"`
	Monthly int64  `json:"monthly"`
	By      string `json:"by"`
	Sort    int    `json:"sort"`
}

// Debt is a loan or credit line being paid down. Remaining is derived
// (Original - Paid). `Calc` selects the interest method for the schedule.
type Debt struct {
	ID         uint    `gorm:"primaryKey" json:"id"`
	Name       string  `json:"name"`
	Th         string  `json:"th"`
	Icon       string  `json:"icon"`
	Tint       string  `json:"tint"`
	Original   int64   `json:"original"`
	Paid       int64   `json:"paid"`
	Apr        float64 `json:"apr"`
	Monthly    int64   `json:"monthly"`
	Calc       string  `json:"calc"` // flat | reducing
	Payoff     string  `json:"payoff"`
	PayoffTh   string  `json:"payoffTh"`
	MonthsLeft int     `json:"monthsLeft"`
	Done       bool    `json:"done"`
	Revolving  bool    `json:"revolving"`
	Sort       int     `json:"sort"`
}

// Asset is something owned, valued at a point in time (Net Worth screen).
type Asset struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Name  string `json:"name"`
	Th    string `json:"th"`
	Icon  string `json:"icon"`
	Tint  string `json:"tint"`
	Value int64  `json:"value"`
	Sort  int    `json:"sort"`
}

// Bill is a recurring or one-time payment with a day-of-month due date.
type Bill struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	Name   string `json:"name"`
	Th     string `json:"th"`
	Icon   string `json:"icon"`
	Tint   string `json:"tint"`
	Amount int64  `json:"amount"`
	DueDay int    `json:"dueDay"`
	Paid   bool   `json:"paid"`
	Freq   string `json:"freq"`                      // monthly | once
	CatKey string `gorm:"column:cat_key" json:"cat"` // bills | fun | debt
	Sort   int    `json:"sort"`
}

// Channel is a savings / investment vehicle configured in Setup.
type Channel struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	Name      string `json:"name"`
	Th        string `json:"th"`
	Kind      string `json:"kind"` // saving | mf | pf | stock | gold | bond
	Icon      string `json:"icon"`
	Tint      string `json:"tint"`
	Opening   int64  `json:"opening"`
	StartDate string `json:"startDate"`
	StartTh   string `json:"startTh"`
	Sort      int    `json:"sort"`
}

// IncomeCategory configures income sources in Setup.
type IncomeCategory struct {
	ID   uint   `gorm:"primaryKey" json:"id"`
	Name string `json:"name"`
	Th   string `json:"th"`
	Sub  string `json:"sub"` // main | side | passive
	Icon string `json:"icon"`
	Tint string `json:"tint"`
	Sort int    `json:"sort"`
}

// PlanItem is a single planned-vs-actual row for a month. Type partitions the
// three plan tables (income / expense / savings).
type PlanItem struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Type    string `json:"type"` // income | expense | savings
	Name    string `json:"name"`
	Th      string `json:"th"`
	Icon    string `json:"icon"`
	Tint    string `json:"tint"`
	CatKey  string `gorm:"column:cat_key" json:"cat"`
	Sub     string `json:"sub"`
	Planned int64  `json:"planned"`
	Actual  int64  `json:"actual"`
	Month   string `json:"month"` // YYYY-MM
	Sort    int    `json:"sort"`
}

// AssetSnapshot is a mark-to-market valuation pair (previous + current month)
// powering the Plan "Asset update" tab.
type AssetSnapshot struct {
	ID    uint   `gorm:"primaryKey" json:"id"`
	Name  string `json:"name"`
	Th    string `json:"th"`
	Grp   string `gorm:"column:grp" json:"group"` // bank | savings | invest | other
	Icon  string `json:"icon"`
	Tint  string `json:"tint"`
	Prev  int64  `json:"prev"`
	Curr  int64  `json:"curr"`
	Month string `json:"month"` // current month key, YYYY-MM
	Sort  int    `json:"sort"`
}

// NetWorthHistory is a monthly net-worth point for the trend chart.
type NetWorthHistory struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Month   string `json:"month"`
	MonthTh string `json:"monthTh"`
	Value   int64  `json:"value"`
	Sort    int    `json:"sort"`
}

// MonthlyCashflow is income vs expense for a month (dashboard cashflow chart).
type MonthlyCashflow struct {
	ID      uint   `gorm:"primaryKey" json:"id"`
	Month   string `json:"month"`
	Income  int64  `json:"income"`
	Expense int64  `json:"expense"`
	Sort    int    `json:"sort"`
}

// DaySpend is total spend on a day of the month (bills calendar heatmap).
type DaySpend struct {
	ID     uint   `gorm:"primaryKey" json:"id"`
	Day    int    `json:"day"`
	Amount int64  `json:"amount"`
	Month  string `json:"month"` // YYYY-MM
}

// SetupGoal configures the emergency / stocks / retirement / custom goals.
type SetupGoal struct {
	ID          uint               `gorm:"primaryKey" json:"id"`
	Kind        string             `json:"kind"` // emergency | stocks | retirement | custom
	Name        string             `json:"name"`
	Th          string             `json:"th"`
	Icon        string             `json:"icon"`
	Tint        string             `json:"tint"`
	StartDate   string             `json:"startDate"`
	StartTh     string             `json:"startTh"`
	EndDate     string             `json:"endDate"`
	EndTh       string             `json:"endTh"`
	Inflation   float64            `json:"inflation"`
	Target      int64              `json:"target"`
	Opening     int64              `json:"opening"`
	CurrentAge  int                `json:"currentAge,omitempty"`
	RetireAge   int                `json:"retireAge,omitempty"`
	UseUntilAge int                `json:"useUntilAge,omitempty"`
	MonthlyNeed int64              `json:"monthlyNeed,omitempty"`
	Sort        int                `json:"sort"`
	Channels    []SetupGoalChannel `gorm:"foreignKey:SetupGoalID" json:"channels"`
}

// SetupGoalChannel is an allocation slice of a SetupGoal across a channel.
type SetupGoalChannel struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	SetupGoalID uint   `json:"-"`
	Name        string `json:"name"`
	Th          string `json:"th"`
	Pct         int    `json:"pct"`
}

// AllModels returns every model for AutoMigrate, in dependency order.
func AllModels() []any {
	return []any{
		&Account{}, &Category{}, &Transaction{}, &Budget{}, &Goal{},
		&Debt{}, &Asset{}, &Bill{}, &Channel{}, &IncomeCategory{},
		&PlanItem{}, &AssetSnapshot{}, &NetWorthHistory{}, &MonthlyCashflow{},
		&DaySpend{}, &SetupGoal{}, &SetupGoalChannel{},
	}
}
