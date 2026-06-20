package plan

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/result"
	"github.com/samber/mo"
)

// Service is the Orchestration: it reads plan rows and snapshots via the
// repository and assembles them with the pure builders.
type Service struct {
	repo Repository
}

// NewService wires the plan service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ViewPlan returns the monthly plan grouped with its roll-up summary.
func (s *Service) ViewPlan(month string) mo.Result[PlanView] {
	return result.Map(s.repo.FindPlanItems(month), BuildPlan)
}

// ViewSnapshots returns the grouped mark-to-market valuations plus the trend.
func (s *Service) ViewSnapshots() mo.Result[SnapshotsView] {
	snaps, err := s.repo.FindSnapshots().Get()
	if err != nil {
		return mo.Err[SnapshotsView](err)
	}
	hist, err := s.repo.FindNetWorthHistory().Get()
	if err != nil {
		return mo.Err[SnapshotsView](err)
	}
	return mo.Ok(BuildSnapshots(snaps, hist))
}
