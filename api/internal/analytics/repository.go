package analytics

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the read-only storage port (test seam) for analytics. Analytics
// is a read-model context: it reads across several shared tables and writes none,
// which is why one port exposes many focused finders.
type Repository interface {
	FindBudgetsBySpend() mo.Result[[]model.Budget]
	FindCategories() mo.Result[[]model.Category]
	FindAssetsByValue() mo.Result[[]model.Asset]
	FindActiveDebts() mo.Result[[]model.Debt]
	FindMonthlyCashflow() mo.Result[[]model.MonthlyCashflow]
	FindGoals() mo.Result[[]model.Goal]
	FindNetWorthHistory() mo.Result[[]model.NetWorthHistory]
	FindUnpaidBills() mo.Result[[]model.Bill]
	FindExpenseTransactions() mo.Result[[]model.Transaction]
}

// repo is the GORM-backed read Repository (Side Effects).
type repo struct {
	db *gorm.DB
}

// NewRepository builds an analytics repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindBudgetsBySpend returns budgets ordered by spend, high to low.
func (r *repo) FindBudgetsBySpend() mo.Result[[]model.Budget] {
	return store.Collect[model.Budget](r.db.Order("spent desc"))
}

// FindCategories returns all categories (used to label budget spend).
func (r *repo) FindCategories() mo.Result[[]model.Category] {
	return store.Collect[model.Category](r.db)
}

// FindAssetsByValue returns assets ordered by value, high to low.
func (r *repo) FindAssetsByValue() mo.Result[[]model.Asset] {
	return store.Collect[model.Asset](r.db.Order("value desc"))
}

// FindActiveDebts returns debts that are not yet paid off.
func (r *repo) FindActiveDebts() mo.Result[[]model.Debt] {
	return store.Collect[model.Debt](r.db.Where("done = ?", false))
}

// FindMonthlyCashflow returns the monthly cashflow series ordered by sort.
func (r *repo) FindMonthlyCashflow() mo.Result[[]model.MonthlyCashflow] {
	return store.Collect[model.MonthlyCashflow](r.db.Order("sort asc"))
}

// FindGoals returns goals ordered by sort.
func (r *repo) FindGoals() mo.Result[[]model.Goal] {
	return store.Collect[model.Goal](r.db.Order("sort asc"))
}

// FindNetWorthHistory returns the net-worth trend ordered by sort.
func (r *repo) FindNetWorthHistory() mo.Result[[]model.NetWorthHistory] {
	return store.Collect[model.NetWorthHistory](r.db.Order("sort asc"))
}

// FindUnpaidBills returns unpaid bills ordered by due day.
func (r *repo) FindUnpaidBills() mo.Result[[]model.Bill] {
	return store.Collect[model.Bill](r.db.Where("paid = ?", false).Order("due_day asc"))
}

// FindExpenseTransactions returns all expense (negative amount) transactions.
func (r *repo) FindExpenseTransactions() mo.Result[[]model.Transaction] {
	return store.Collect[model.Transaction](r.db.Where("amount < 0"))
}

var _ Repository = (*repo)(nil)
