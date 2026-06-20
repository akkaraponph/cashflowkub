// Package result holds small helpers over samber/mo's Result type.
//
// mo.Result's own Map is same-type (T -> T) because Go methods can't introduce
// new type parameters. Services routinely turn a Result of stored rows into a
// Result of view DTOs, so Map here bridges T -> U while propagating errors.
package result

import "github.com/samber/mo"

// Map transforms the value of an Ok result with f, passing any error through
// unchanged. It is the standard way a service maps repository output to a view.
func Map[T, U any](r mo.Result[T], f func(T) U) mo.Result[U] {
	v, err := r.Get()
	if err != nil {
		return mo.Err[U](err)
	}
	return mo.Ok(f(v))
}
