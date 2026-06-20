package bill

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the storage port (test seam) for bills. FindByStatus with an
// empty status returns every bill ordered by due day (used by the summary).
type Repository interface {
	FindByStatus(status string) mo.Result[[]model.Bill]
	FindByID(id string) mo.Result[model.Bill]
	Save(b *model.Bill) mo.Result[model.Bill]
	FindDaySpend(month string) mo.Result[[]model.DaySpend]
}

// repo is the GORM-backed Repository (Side Effects).
type repo struct {
	db *gorm.DB
}

// NewRepository builds a bill repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindByStatus returns bills ordered by due day; "paid"/"unpaid" filters, ""=all.
func (r *repo) FindByStatus(status string) mo.Result[[]model.Bill] {
	q := r.db.Order("due_day asc, sort asc")
	switch status {
	case "paid":
		q = q.Where("paid = ?", true)
	case "unpaid":
		q = q.Where("paid = ?", false)
	}
	return store.Collect[model.Bill](q)
}

// FindByID loads one bill (ErrNotFound if missing).
func (r *repo) FindByID(id string) mo.Result[model.Bill] {
	return store.FindByID[model.Bill](r.db, id)
}

// Save persists the full bill struct.
func (r *repo) Save(b *model.Bill) mo.Result[model.Bill] {
	return store.Save(r.db, b)
}

// FindDaySpend returns the daily-spend rows for a month, ordered by day.
func (r *repo) FindDaySpend(month string) mo.Result[[]model.DaySpend] {
	return store.Collect[model.DaySpend](r.db.Where("month = ?", month).Order("day asc"))
}

var _ Repository = (*repo)(nil)
