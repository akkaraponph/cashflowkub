package analytics

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/clock"
	"github.com/samber/mo"
)

// Service is the Orchestration: it gathers the rows each screen needs via the
// read repository, stamps "today" from the clock, and hands them to the pure
// builders.
type Service struct {
	repo Repository
}

// NewService wires the analytics service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ViewDashboard aggregates everything the home screen needs.
func (s *Service) ViewDashboard() mo.Result[DashboardView] {
	assets, err := s.repo.FindAssetsByValue().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	activeDebts, err := s.repo.FindActiveDebts().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	budgets, err := s.repo.FindBudgetsBySpend().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	cats, err := s.repo.FindCategories().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	cashflow, err := s.repo.FindMonthlyCashflow().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	bills, err := s.repo.FindUnpaidBills().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	goals, err := s.repo.FindGoals().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	hist, err := s.repo.FindNetWorthHistory().Get()
	if err != nil {
		return mo.Err[DashboardView](err)
	}
	return mo.Ok(BuildDashboard(DashboardInput{
		Assets:       assets,
		ActiveDebts:  activeDebts,
		Budgets:      budgets,
		Categories:   cats,
		Cashflow:     cashflow,
		UnpaidBills:  bills,
		Goals:        goals,
		NetWorthHist: hist,
		TodayDay:     clock.TodayDay(),
	}))
}

// ViewNetWorth returns the assets/liabilities breakdown plus the trend.
func (s *Service) ViewNetWorth() mo.Result[NetWorthView] {
	assets, err := s.repo.FindAssetsByValue().Get()
	if err != nil {
		return mo.Err[NetWorthView](err)
	}
	activeDebts, err := s.repo.FindActiveDebts().Get()
	if err != nil {
		return mo.Err[NetWorthView](err)
	}
	hist, err := s.repo.FindNetWorthHistory().Get()
	if err != nil {
		return mo.Err[NetWorthView](err)
	}
	return mo.Ok(BuildNetWorth(NetWorthInput{
		Assets:      assets,
		ActiveDebts: activeDebts,
		History:     hist,
	}))
}

// ViewReports returns top merchants, the category breakdown and the series.
func (s *Service) ViewReports() mo.Result[ReportsView] {
	budgets, err := s.repo.FindBudgetsBySpend().Get()
	if err != nil {
		return mo.Err[ReportsView](err)
	}
	cats, err := s.repo.FindCategories().Get()
	if err != nil {
		return mo.Err[ReportsView](err)
	}
	expenseTx, err := s.repo.FindExpenseTransactions().Get()
	if err != nil {
		return mo.Err[ReportsView](err)
	}
	monthly, err := s.repo.FindMonthlyCashflow().Get()
	if err != nil {
		return mo.Err[ReportsView](err)
	}
	return mo.Ok(BuildReports(ReportsInput{
		Budgets:    budgets,
		Categories: cats,
		ExpenseTx:  expenseTx,
		Monthly:    monthly,
	}))
}
