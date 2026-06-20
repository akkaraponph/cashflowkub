// Package analytics is the analytics read-model domain (flat package). This file
// holds the Pure Logic: spending breakdowns, net-worth totals, debt roll-ups and
// merchant ranking, plus the assembled dashboard/net-worth/reports views. Inputs
// are bundled in *Input structs so the builders take a single argument and stay
// easy to test. No I/O, no clock.
package analytics

import (
	"sort"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
)

// CategorySpend is one slice of the spending donut / breakdown.
type CategorySpend struct {
	Cat   string  `json:"cat"`
	Label string  `json:"label"`
	Th    string  `json:"th"`
	Tint  string  `json:"tint"`
	Icon  string  `json:"icon"`
	Spent int64   `json:"spent"`
	Pct   float64 `json:"pct"` // share of total, 0..100
}

// Merchant is one row of the top-merchants table.
type Merchant struct {
	Name  string `json:"name"`
	Cat   string `json:"cat"`
	Total int64  `json:"total"`
}

// SpendingByCategory joins budget spend to category metadata, preserving the
// order of budgets (the repository sorts them high-to-low). Returns the slices
// plus the grand total.
func SpendingByCategory(budgets []model.Budget, cats []model.Category) ([]CategorySpend, int64) {
	catByKey := make(map[string]model.Category, len(cats))
	for _, c := range cats {
		catByKey[c.Key] = c
	}
	var total int64
	for _, b := range budgets {
		total += b.Spent
	}
	out := make([]CategorySpend, 0, len(budgets))
	for _, b := range budgets {
		cat := catByKey[b.CatKey]
		pct := 0.0
		if total > 0 {
			pct = float64(b.Spent) / float64(total) * 100
		}
		out = append(out, CategorySpend{
			Cat: b.CatKey, Label: cat.Label, Th: cat.Th, Tint: cat.Tint, Icon: cat.Icon,
			Spent: b.Spent, Pct: pct,
		})
	}
	return out, total
}

// NetWorthTotals returns total assets, total active-liabilities and net worth.
func NetWorthTotals(assets []model.Asset, activeDebts []model.Debt) (assetsTotal, liabilities, net int64) {
	for _, a := range assets {
		assetsTotal += a.Value
	}
	for _, d := range activeDebts {
		if rem := d.Original - d.Paid; rem > 0 {
			liabilities += rem
		}
	}
	net = assetsTotal - liabilities
	return
}

// TopMerchants ranks expense transactions by total spend, keeping the top six.
func TopMerchants(expenseTx []model.Transaction) []Merchant {
	totals := map[string]int64{}
	cat := map[string]string{}
	for _, t := range expenseTx {
		totals[t.Name] += -t.Amount
		cat[t.Name] = t.CatKey
	}
	out := make([]Merchant, 0, len(totals))
	for name, tot := range totals {
		out = append(out, Merchant{Name: name, Cat: cat[name], Total: tot})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Total > out[j].Total })
	if len(out) > 6 {
		out = out[:6]
	}
	return out
}

// debtRollup sums active debts and picks the highest-APR one as the focus
// (avalanche default).
func debtRollup(activeDebts []model.Debt) (original, paid, remaining int64, focus *view.Debt, progress float64) {
	for _, d := range activeDebts {
		original += d.Original
		paid += d.Paid
		remaining += d.Original - d.Paid
		if focus == nil || d.Apr > focus.Apr {
			v := view.FromDebt(d)
			focus = &v
		}
	}
	if original > 0 {
		progress = float64(paid) / float64(original)
	}
	return
}

// MonthFlow is the current month's income/expense/net.
type MonthFlow struct {
	Income  int64 `json:"income"`
	Expense int64 `json:"expense"`
	Net     int64 `json:"net"`
}

// DebtSummary is the dashboard's debt focus block.
type DebtSummary struct {
	Original  int64      `json:"original"`
	Paid      int64      `json:"paid"`
	Remaining int64      `json:"remaining"`
	Progress  float64    `json:"progress"`
	Focus     *view.Debt `json:"focus"`
}

// DashboardInput bundles everything the home screen aggregates.
type DashboardInput struct {
	Assets       []model.Asset
	ActiveDebts  []model.Debt
	Budgets      []model.Budget
	Categories   []model.Category
	Cashflow     []model.MonthlyCashflow
	UnpaidBills  []model.Bill
	Goals        []model.Goal
	NetWorthHist []model.NetWorthHistory
	TodayDay     int
}

// DashboardView is the GET /dashboard response.
type DashboardView struct {
	NetWorth     int64                   `json:"netWorth"`
	TotalAssets  int64                   `json:"totalAssets"`
	TotalLiab    int64                   `json:"totalLiab"`
	Month        MonthFlow               `json:"month"`
	Cashflow     []model.MonthlyCashflow `json:"cashflow"`
	Spending     []CategorySpend         `json:"spending"`
	SpendTotal   int64                   `json:"spendTotal"`
	Debt         DebtSummary             `json:"debt"`
	NextBill     *view.Bill              `json:"nextBill"`
	Goals        []model.Goal            `json:"goals"`
	NetWorthHist []model.NetWorthHistory `json:"netWorthHist"`
}

// BuildDashboard assembles the dashboard from its inputs.
func BuildDashboard(in DashboardInput) DashboardView {
	assetsTotal, liabilities, net := NetWorthTotals(in.Assets, in.ActiveDebts)

	var monthIncome, monthExpense int64
	if n := len(in.Cashflow); n > 0 {
		monthIncome = in.Cashflow[n-1].Income
		monthExpense = in.Cashflow[n-1].Expense
	}

	spending, spendTotal := SpendingByCategory(in.Budgets, in.Categories)
	original, paid, remaining, focus, progress := debtRollup(in.ActiveDebts)

	var nextBill *view.Bill
	if len(in.UnpaidBills) > 0 {
		v := view.FromBill(in.UnpaidBills[0], in.TodayDay)
		nextBill = &v
	}

	return DashboardView{
		NetWorth:     net,
		TotalAssets:  assetsTotal,
		TotalLiab:    liabilities,
		Month:        MonthFlow{Income: monthIncome, Expense: monthExpense, Net: monthIncome - monthExpense},
		Cashflow:     in.Cashflow,
		Spending:     spending,
		SpendTotal:   spendTotal,
		Debt:         DebtSummary{Original: original, Paid: paid, Remaining: remaining, Progress: progress, Focus: focus},
		NextBill:     nextBill,
		Goals:        in.Goals,
		NetWorthHist: in.NetWorthHist,
	}
}

// NetWorthInput bundles the net-worth screen inputs. Assets are expected ordered
// value-descending (the array is returned as-is).
type NetWorthInput struct {
	Assets      []model.Asset
	ActiveDebts []model.Debt
	History     []model.NetWorthHistory
}

// NetWorthView is the GET /networth response.
type NetWorthView struct {
	NetWorth    int64                   `json:"netWorth"`
	TotalAssets int64                   `json:"totalAssets"`
	TotalLiab   int64                   `json:"totalLiab"`
	Assets      []model.Asset           `json:"assets"`
	Liabilities []view.Debt             `json:"liabilities"`
	History     []model.NetWorthHistory `json:"history"`
}

// BuildNetWorth assembles the net-worth breakdown, sorting liabilities by
// remaining balance descending.
func BuildNetWorth(in NetWorthInput) NetWorthView {
	assetsTotal, liabilities, net := NetWorthTotals(in.Assets, in.ActiveDebts)
	liabRows := view.FromDebts(in.ActiveDebts)
	sort.Slice(liabRows, func(i, j int) bool { return liabRows[i].Remaining > liabRows[j].Remaining })
	return NetWorthView{
		NetWorth:    net,
		TotalAssets: assetsTotal,
		TotalLiab:   liabilities,
		Assets:      in.Assets,
		Liabilities: liabRows,
		History:     in.History,
	}
}

// ReportsInput bundles the reports screen inputs.
type ReportsInput struct {
	Budgets    []model.Budget
	Categories []model.Category
	ExpenseTx  []model.Transaction
	Monthly    []model.MonthlyCashflow
}

// ReportsView is the GET /reports response.
type ReportsView struct {
	Breakdown    []CategorySpend         `json:"breakdown"`
	SpendTotal   int64                   `json:"spendTotal"`
	TopMerchants []Merchant              `json:"topMerchants"`
	Monthly      []model.MonthlyCashflow `json:"monthly"`
}

// BuildReports assembles the reports view.
func BuildReports(in ReportsInput) ReportsView {
	breakdown, spendTotal := SpendingByCategory(in.Budgets, in.Categories)
	return ReportsView{
		Breakdown:    breakdown,
		SpendTotal:   spendTotal,
		TopMerchants: TopMerchants(in.ExpenseTx),
		Monthly:      in.Monthly,
	}
}
