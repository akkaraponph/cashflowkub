package debt

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/result"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
	"github.com/samber/mo"
)

// Service is the Orchestration: it reads debts via the repository, derives
// views/schedules with the pure functions, and persists payments.
type Service struct {
	repo Repository
}

// NewService wires the debt service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ListDebts returns debts (optionally filtered by status) in view shape.
func (s *Service) ListDebts(status string) mo.Result[[]view.Debt] {
	return result.Map(s.repo.FindByStatus(status), view.FromDebts)
}

// ViewDebt returns one debt in view shape (404 if missing).
func (s *Service) ViewDebt(id string) mo.Result[view.Debt] {
	return result.Map(s.repo.FindByID(id), view.FromDebt)
}

// ViewSchedule returns the amortization schedule for one debt.
func (s *Service) ViewSchedule(id string) mo.Result[ScheduleView] {
	return result.Map(s.repo.FindByID(id), BuildSchedule)
}

// PayDebt applies a payment and returns the updated debt view.
func (s *Service) PayDebt(id string, amount int64) mo.Result[view.Debt] {
	d, err := s.repo.FindByID(id).Get()
	if err != nil {
		return mo.Err[view.Debt](err)
	}
	updated := ApplyPayment(d, amount)
	return result.Map(s.repo.Save(&updated), view.FromDebt)
}
