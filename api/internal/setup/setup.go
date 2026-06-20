// Package setup is the setup read-model domain (flat package). This file holds
// the Pure Logic: partitioning categories, debts and configured goals into the
// shapes the Financial Setup screen expects.
package setup

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
)

// DebtsView splits active debts into closing (amortizing) and revolving.
type DebtsView struct {
	Closing   []view.Debt `json:"closing"`
	Revolving []view.Debt `json:"revolving"`
}

// GoalsView is the configured goals block: the three fixed kinds plus custom.
type GoalsView struct {
	Emergency  *model.SetupGoal  `json:"emergency"`
	Stocks     *model.SetupGoal  `json:"stocks"`
	Retirement *model.SetupGoal  `json:"retirement"`
	Custom     []model.SetupGoal `json:"custom"`
}

// SetupView is the GET /setup response.
type SetupView struct {
	IncomeCategories  []model.Category       `json:"incomeCategories"`
	ExpenseCategories []model.Category       `json:"expenseCategories"`
	IncomeSources     []model.IncomeCategory `json:"incomeSources"`
	Channels          []model.Channel        `json:"channels"`
	Accounts          []model.Account        `json:"accounts"`
	Debts             DebtsView              `json:"debts"`
	Goals             GoalsView              `json:"goals"`
}

// SetupInput bundles everything the setup screen configures.
type SetupInput struct {
	Categories    []model.Category
	IncomeSources []model.IncomeCategory
	Channels      []model.Channel
	Accounts      []model.Account
	ActiveDebts   []model.Debt
	SetupGoals    []model.SetupGoal
}

// BuildSetup partitions categories by type, debts by revolving, and goals by
// kind, assembling the setup view.
func BuildSetup(in SetupInput) SetupView {
	var income, expense []model.Category
	for _, cat := range in.Categories {
		if cat.Type == "income" {
			income = append(income, cat)
		} else {
			expense = append(expense, cat)
		}
	}

	var closing, revolving []view.Debt
	for _, d := range in.ActiveDebts {
		v := view.FromDebt(d)
		if d.Revolving {
			revolving = append(revolving, v)
		} else {
			closing = append(closing, v)
		}
	}

	var custom []model.SetupGoal
	var emergency, stocks, retirement *model.SetupGoal
	for i := range in.SetupGoals {
		g := in.SetupGoals[i]
		switch g.Kind {
		case "custom":
			custom = append(custom, g)
		case "emergency":
			gg := g
			emergency = &gg
		case "stocks":
			gg := g
			stocks = &gg
		case "retirement":
			gg := g
			retirement = &gg
		}
	}

	return SetupView{
		IncomeCategories:  income,
		ExpenseCategories: expense,
		IncomeSources:     in.IncomeSources,
		Channels:          in.Channels,
		Accounts:          in.Accounts,
		Debts:             DebtsView{Closing: closing, Revolving: revolving},
		Goals:             GoalsView{Emergency: emergency, Stocks: stocks, Retirement: retirement, Custom: custom},
	}
}
