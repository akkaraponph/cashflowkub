package setup

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the read-only storage port (test seam) for setup.
type Repository interface {
	FindCategories() mo.Result[[]model.Category]
	FindIncomeSources() mo.Result[[]model.IncomeCategory]
	FindChannels() mo.Result[[]model.Channel]
	FindAccounts() mo.Result[[]model.Account]
	FindActiveDebts() mo.Result[[]model.Debt]
	FindSetupGoals() mo.Result[[]model.SetupGoal]
}

// repo is the GORM-backed read Repository (Side Effects).
type repo struct {
	db *gorm.DB
}

// NewRepository builds a setup repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindCategories returns all categories ordered by sort.
func (r *repo) FindCategories() mo.Result[[]model.Category] {
	return store.Collect[model.Category](r.db.Order("sort asc"))
}

// FindIncomeSources returns the configured income categories ordered by sort.
func (r *repo) FindIncomeSources() mo.Result[[]model.IncomeCategory] {
	return store.Collect[model.IncomeCategory](r.db.Order("sort asc"))
}

// FindChannels returns savings/investment channels ordered by sort.
func (r *repo) FindChannels() mo.Result[[]model.Channel] {
	return store.Collect[model.Channel](r.db.Order("sort asc"))
}

// FindAccounts returns accounts ordered by sort.
func (r *repo) FindAccounts() mo.Result[[]model.Account] {
	return store.Collect[model.Account](r.db.Order("sort asc"))
}

// FindActiveDebts returns not-yet-paid debts ordered by sort.
func (r *repo) FindActiveDebts() mo.Result[[]model.Debt] {
	return store.Collect[model.Debt](r.db.Where("done = ?", false).Order("sort asc"))
}

// FindSetupGoals returns configured goals with their channel allocations.
func (r *repo) FindSetupGoals() mo.Result[[]model.SetupGoal] {
	return store.Collect[model.SetupGoal](r.db.Preload("Channels").Order("sort asc"))
}

var _ Repository = (*repo)(nil)
