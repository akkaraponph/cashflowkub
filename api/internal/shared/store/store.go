// Package store holds generic GORM helpers shared by every repository adapter.
//
// These are the canonical Side Effect primitives: each touches the database and
// returns a mo.Result so the (value, error) shape never leaks past the adapter
// boundary. Repositories stay thin wrappers that build the query and delegate
// here; business logic never lives in this package.
package store

import (
	"errors"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/apperr"
	"github.com/samber/mo"
	"gorm.io/gorm"
)

// List loads every row of T, optionally ordered (e.g. "sort asc").
func List[T any](db *gorm.DB, order string) mo.Result[[]T] {
	q := db
	if order != "" {
		q = q.Order(order)
	}
	return Collect[T](q)
}

// Collect runs a caller-built query and returns the matching rows. Use this when
// the domain needs filters or joins the generic List can't express.
func Collect[T any](q *gorm.DB) mo.Result[[]T] {
	var items []T
	if err := q.Find(&items).Error; err != nil {
		return mo.Err[[]T](err)
	}
	return mo.Ok(items)
}

// FindByID loads one row by primary key, mapping a missing row to apperr.ErrNotFound.
func FindByID[T any](db *gorm.DB, id string) mo.Result[T] {
	var item T
	if err := db.First(&item, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return mo.Err[T](apperr.ErrNotFound)
		}
		return mo.Err[T](err)
	}
	return mo.Ok(item)
}

// Insert creates a new row and returns the stored value (with generated ID).
func Insert[T any](db *gorm.DB, item *T) mo.Result[T] {
	if err := db.Create(item).Error; err != nil {
		return mo.Err[T](err)
	}
	return mo.Ok(*item)
}

// Save persists the full struct (insert-or-update by primary key).
func Save[T any](db *gorm.DB, item *T) mo.Result[T] {
	if err := db.Save(item).Error; err != nil {
		return mo.Err[T](err)
	}
	return mo.Ok(*item)
}

// Remove deletes a row by primary key. The boolean is always true on success;
// it exists so the result carries a value rather than a bare error.
func Remove[T any](db *gorm.DB, id string) mo.Result[bool] {
	var item T
	if err := db.Delete(&item, "id = ?", id).Error; err != nil {
		return mo.Err[bool](err)
	}
	return mo.Ok(true)
}
