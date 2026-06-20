// Package reference is the generic CRUD domain (flat package) shared by the
// simple resources (accounts, categories, budgets, …) and by the create/mutation
// routes of the custom domains. Reference data is plain CRUD over one table, so
// the whole stack — repository, service, handler — is generic over the model T.
//
// This file holds the storage seam and its GORM implementation (Side Effects);
// service.go is the Orchestration and handler.go the HTTP transport.
package reference

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/store"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// Repository is the generic storage port (test seam) for a reference resource.
type Repository[T any] interface {
	List() mo.Result[[]T]
	FindByID(id string) mo.Result[T]
	Create(item *T) mo.Result[T]
	Save(item *T) mo.Result[T]
	Delete(id string) mo.Result[bool]
}

// repo is the GORM-backed generic store, ordered by order on list.
type repo[T any] struct {
	db    *gorm.DB
	order string
}

// NewRepository builds a reference repository. order is an optional ORDER BY for
// List (e.g. "sort asc"); pass "" for none.
func NewRepository[T any](db *gorm.DB, order string) Repository[T] {
	return &repo[T]{db: db, order: order}
}

func (r *repo[T]) List() mo.Result[[]T]             { return store.List[T](r.db, r.order) }
func (r *repo[T]) FindByID(id string) mo.Result[T]  { return store.FindByID[T](r.db, id) }
func (r *repo[T]) Create(item *T) mo.Result[T]      { return store.Insert(r.db, item) }
func (r *repo[T]) Save(item *T) mo.Result[T]        { return store.Save(r.db, item) }
func (r *repo[T]) Delete(id string) mo.Result[bool] { return store.Remove[T](r.db, id) }

var _ Repository[any] = (*repo[any])(nil)
