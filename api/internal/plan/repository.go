package plan

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the storage port (test seam) for plan data.
type Repository interface {
	FindPlanItems(month string) mo.Result[[]model.PlanItem]
	FindSnapshots() mo.Result[[]model.AssetSnapshot]
	FindNetWorthHistory() mo.Result[[]model.NetWorthHistory]
}

// repo is the GORM-backed Repository (Side Effects).
type repo struct {
	db *gorm.DB
}

// NewRepository builds a plan repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindPlanItems returns plan rows ordered by sort; month "" returns all months.
func (r *repo) FindPlanItems(month string) mo.Result[[]model.PlanItem] {
	q := r.db.Order("sort asc")
	if month != "" {
		q = q.Where("month = ?", month)
	}
	return store.Collect[model.PlanItem](q)
}

// FindSnapshots returns asset snapshots ordered by sort.
func (r *repo) FindSnapshots() mo.Result[[]model.AssetSnapshot] {
	return store.Collect[model.AssetSnapshot](r.db.Order("sort asc"))
}

// FindNetWorthHistory returns the net-worth trend ordered by sort.
func (r *repo) FindNetWorthHistory() mo.Result[[]model.NetWorthHistory] {
	return store.Collect[model.NetWorthHistory](r.db.Order("sort asc"))
}

var _ Repository = (*repo)(nil)
