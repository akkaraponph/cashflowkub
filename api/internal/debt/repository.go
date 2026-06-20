package debt

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the storage port (test seam) for debts.
type Repository interface {
	FindByStatus(status string) mo.Result[[]model.Debt]
	FindByID(id string) mo.Result[model.Debt]
	Save(d *model.Debt) mo.Result[model.Debt]
}

// repo is the GORM-backed Repository (Side Effects).
type repo struct {
	db *gorm.DB
}

// NewRepository builds a debt repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindByStatus returns debts ordered active-first; status "active"/"paid" filters.
func (r *repo) FindByStatus(status string) mo.Result[[]model.Debt] {
	q := r.db.Order("done asc, sort asc")
	switch status {
	case "active":
		q = q.Where("done = ?", false)
	case "paid":
		q = q.Where("done = ?", true)
	}
	return store.Collect[model.Debt](q)
}

// FindByID loads one debt (ErrNotFound if missing).
func (r *repo) FindByID(id string) mo.Result[model.Debt] {
	return store.FindByID[model.Debt](r.db, id)
}

// Save persists the full debt struct.
func (r *repo) Save(d *model.Debt) mo.Result[model.Debt] {
	return store.Save(r.db, d)
}

var _ Repository = (*repo)(nil)
