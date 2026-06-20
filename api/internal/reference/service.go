package reference

import "github.com/samber/mo"

// Service is the generic reference Orchestration. For plain reference data it is
// a pass-through to the repository — there is no extra business step — but it
// still goes through the seam so validation can be added later.
type Service[T any] struct {
	repo Repository[T]
}

// NewService wires a reference service to its repository.
func NewService[T any](repo Repository[T]) *Service[T] { return &Service[T]{repo: repo} }

func (s *Service[T]) List() mo.Result[[]T]             { return s.repo.List() }
func (s *Service[T]) View(id string) mo.Result[T]      { return s.repo.FindByID(id) }
func (s *Service[T]) Add(item *T) mo.Result[T]         { return s.repo.Create(item) }
func (s *Service[T]) Save(item *T) mo.Result[T]        { return s.repo.Save(item) }
func (s *Service[T]) Remove(id string) mo.Result[bool] { return s.repo.Delete(id) }
