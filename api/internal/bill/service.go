package bill

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/clock"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/result"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
	"github.com/samber/mo"
)

// Service is the Orchestration: it reads bills and the day-spend map via the
// repository, stamps today/month from the clock, and builds the pure views.
type Service struct {
	repo Repository
}

// NewService wires the bill service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ListBills returns bills (optionally filtered by status) in view shape.
func (s *Service) ListBills(status string) mo.Result[[]view.Bill] {
	todayDay := clock.TodayDay()
	return result.Map(s.repo.FindByStatus(status), func(bills []model.Bill) []view.Bill {
		return view.FromBills(bills, todayDay)
	})
}

// Summary builds the month summary from all bills plus the day-spend map.
func (s *Service) Summary() mo.Result[SummaryView] {
	bills, err := s.repo.FindByStatus("").Get()
	if err != nil {
		return mo.Err[SummaryView](err)
	}
	days, err := s.repo.FindDaySpend(clock.CurrentMonth).Get()
	if err != nil {
		return mo.Err[SummaryView](err)
	}
	return mo.Ok(BuildSummary(bills, days, clock.TodayDay(), clock.CurrentMonth))
}

// ToggleBillPaid flips (or sets) a bill's paid flag and returns its view.
func (s *Service) ToggleBillPaid(id string, paid *bool) mo.Result[view.Bill] {
	b, err := s.repo.FindByID(id).Get()
	if err != nil {
		return mo.Err[view.Bill](err)
	}
	updated := ApplyPaid(b, paid)
	todayDay := clock.TodayDay()
	return result.Map(s.repo.Save(&updated), func(saved model.Bill) view.Bill {
		return view.FromBill(saved, todayDay)
	})
}
