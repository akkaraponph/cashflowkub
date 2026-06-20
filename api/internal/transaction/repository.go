package transaction

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the storage port (the test seam). The service depends on this
// interface, not the concrete GORM store below.
type Repository interface {
	FindFiltered(f Filter) mo.Result[[]model.Transaction]
	FindByID(id string) mo.Result[model.Transaction]
	Insert(t *model.Transaction) mo.Result[model.Transaction]
}

// repo is the GORM-backed Repository. Every method is a Side Effect that wraps
// the (value, error) shape into mo.Result via the shared store helpers.
type repo struct {
	db *gorm.DB
}

// NewRepository builds a transaction repository.
func NewRepository(db *gorm.DB) Repository { return &repo{db: db} }

// FindFiltered applies the filter and returns matching rows, newest first.
func (r *repo) FindFiltered(f Filter) mo.Result[[]model.Transaction] {
	q := r.db.Model(&model.Transaction{}).Order("date desc, id desc")
	switch f.Type {
	case "income":
		q = q.Where("amount > 0")
	case "expense":
		q = q.Where("amount < 0")
	}
	if f.Category != "" {
		q = q.Where("cat_key = ?", f.Category)
	}
	if f.Account != "" {
		q = q.Where("account = ?", f.Account)
	}
	if f.From != "" {
		q = q.Where("date >= ?", f.From)
	}
	if f.To != "" {
		q = q.Where("date <= ?", f.To)
	}
	if f.Limit > 0 {
		q = q.Limit(f.Limit)
	}
	return store.Collect[model.Transaction](q)
}

// FindByID loads one transaction (ErrNotFound if missing).
func (r *repo) FindByID(id string) mo.Result[model.Transaction] {
	return store.FindByID[model.Transaction](r.db, id)
}

// Insert stores a new transaction and returns it with its generated ID.
func (r *repo) Insert(t *model.Transaction) mo.Result[model.Transaction] {
	return store.Insert(r.db, t)
}

var _ Repository = (*repo)(nil)
