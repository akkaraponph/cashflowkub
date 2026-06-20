// Package plan is the plan domain (flat package). This file holds the Pure
// Logic: grouping plan items into income/expense/savings tables with totals, and
// grouping asset snapshots into the mark-to-market view. All deterministic over
// the input rows.
package plan

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
)

// PlanGroup is one plan table (income/expense/savings) with its totals.
type PlanGroup struct {
	Type         string           `json:"type"`
	Items        []model.PlanItem `json:"items"`
	TotalPlanned int64            `json:"totalPlanned"`
	TotalActual  int64            `json:"totalActual"`
	Variance     int64            `json:"variance"`
}

// PlanSummary is the roll-up across the three plan groups.
type PlanSummary struct {
	PlannedNet   int64   `json:"plannedNet"`
	ActualNet    int64   `json:"actualNet"`
	NetVariance  int64   `json:"netVariance"`
	IncomeRatio  float64 `json:"incomeRatio"`
	ExpenseUsage float64 `json:"expenseUsage"`
	SavingsRatio float64 `json:"savingsRatio"`
}

// PlanView is the GET /plan response.
type PlanView struct {
	Income  PlanGroup   `json:"income"`
	Expense PlanGroup   `json:"expense"`
	Savings PlanGroup   `json:"savings"`
	Summary PlanSummary `json:"summary"`
}

// BuildPlan partitions items by type, totals each group, and rolls up the net
// planned-vs-actual summary.
func BuildPlan(items []model.PlanItem) PlanView {
	var inc, exp, sav []model.PlanItem
	for _, it := range items {
		switch it.Type {
		case "income":
			inc = append(inc, it)
		case "expense":
			exp = append(exp, it)
		case "savings":
			sav = append(sav, it)
		}
	}
	income := buildGroup("income", inc)
	expense := buildGroup("expense", exp)
	savings := buildGroup("savings", sav)

	plannedNet := income.TotalPlanned - expense.TotalPlanned - savings.TotalPlanned
	actualNet := income.TotalActual - expense.TotalActual - savings.TotalActual

	return PlanView{
		Income:  income,
		Expense: expense,
		Savings: savings,
		Summary: PlanSummary{
			PlannedNet:   plannedNet,
			ActualNet:    actualNet,
			NetVariance:  actualNet - plannedNet,
			IncomeRatio:  ratio(income.TotalActual, income.TotalPlanned),
			ExpenseUsage: ratio(expense.TotalActual, expense.TotalPlanned),
			SavingsRatio: ratio(savings.TotalActual, savings.TotalPlanned),
		},
	}
}

func buildGroup(t string, items []model.PlanItem) PlanGroup {
	g := PlanGroup{Type: t, Items: items}
	for _, it := range items {
		g.TotalPlanned += it.Planned
		g.TotalActual += it.Actual
	}
	g.Variance = g.TotalActual - g.TotalPlanned
	return g
}

func ratio(actual, planned int64) float64 {
	if planned == 0 {
		return 0
	}
	return float64(actual) / float64(planned) * 100
}

// SnapshotGroup is one asset group (bank/savings/invest/other) with its totals.
type SnapshotGroup struct {
	Group string                `json:"group"`
	Items []model.AssetSnapshot `json:"items"`
	Prev  int64                 `json:"prev"`
	Curr  int64                 `json:"curr"`
}

// SnapshotLabels are the fixed month labels shown on the Asset update tab.
type SnapshotLabels struct {
	Prev       string `json:"prev"`
	Curr       string `json:"curr"`
	PrevTh     string `json:"prevTh"`
	CurrTh     string `json:"currTh"`
	LastUpdate string `json:"lastUpdate"`
}

// SnapshotsView is the GET /plan/snapshots response.
type SnapshotsView struct {
	Groups  []SnapshotGroup         `json:"groups"`
	Prev    int64                   `json:"prev"`
	Curr    int64                   `json:"curr"`
	Delta   int64                   `json:"delta"`
	History []model.NetWorthHistory `json:"history"`
	Labels  SnapshotLabels          `json:"labels"`
}

// BuildSnapshots groups snapshots by their group key (preserving first-seen
// order), totals prev/curr per group and overall, and attaches the trend.
func BuildSnapshots(snaps []model.AssetSnapshot, hist []model.NetWorthHistory) SnapshotsView {
	groups := map[string][]model.AssetSnapshot{}
	order := []string{}
	var prevTotal, currTotal int64
	for _, s := range snaps {
		if _, ok := groups[s.Grp]; !ok {
			order = append(order, s.Grp)
		}
		groups[s.Grp] = append(groups[s.Grp], s)
		prevTotal += s.Prev
		currTotal += s.Curr
	}
	out := make([]SnapshotGroup, 0, len(order))
	for _, k := range order {
		g := SnapshotGroup{Group: k, Items: groups[k]}
		for _, s := range groups[k] {
			g.Prev += s.Prev
			g.Curr += s.Curr
		}
		out = append(out, g)
	}
	return SnapshotsView{
		Groups:  out,
		Prev:    prevTotal,
		Curr:    currTotal,
		Delta:   currTotal - prevTotal,
		History: hist,
		Labels:  SnapshotLabels{Prev: "May 2026", Curr: "Jun 2026", PrevTh: "พ.ค. 2026", CurrTh: "มิ.ย. 2026", LastUpdate: "May 31, 2026"},
	}
}
