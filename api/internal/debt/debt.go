// Package debt is the debt domain (flat package). This file holds the Pure
// Logic: the amortization schedule and the payment state transition — both
// deterministic functions over a model.Debt, no I/O, no clock.
package debt

import (
	"math"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
)

// ScheduleRow is a single month of an amortization schedule.
type ScheduleRow struct {
	Month     int   `json:"month"`
	Payment   int64 `json:"payment"`
	Principal int64 `json:"principal"`
	Interest  int64 `json:"interest"`
	Balance   int64 `json:"balance"`
}

// ScheduleView is the GET /debts/:id/schedule response.
type ScheduleView struct {
	Debt          view.Debt     `json:"debt"`
	Schedule      []ScheduleRow `json:"schedule"`
	TotalInterest int64         `json:"totalInterest"`
	Months        int           `json:"months"`
}

// BuildSchedule computes the month-by-month payoff using the debt's interest
// method (flat = no recurring interest, since flat debts here are 0%; reducing =
// interest on the outstanding balance).
func BuildSchedule(d model.Debt) ScheduleView {
	balance := d.Original - d.Paid
	monthly := d.Monthly
	rows := make([]ScheduleRow, 0, 64)
	var totalInterest int64

	for i := 1; balance > 0 && i <= 600 && monthly > 0; i++ {
		var interest int64
		if d.Calc == "reducing" && d.Apr > 0 {
			interest = int64(math.Round(float64(balance) * d.Apr / 100 / 12))
		}
		principal := monthly - interest
		if principal <= 0 {
			principal = monthly // guard: APR alone exceeds payment; still chip away
		}
		if principal > balance {
			principal = balance
		}
		payment := principal + interest
		balance -= principal
		totalInterest += interest
		rows = append(rows, ScheduleRow{Month: i, Payment: payment, Principal: principal, Interest: interest, Balance: balance})
	}

	return ScheduleView{Debt: view.FromDebt(d), Schedule: rows, TotalInterest: totalInterest, Months: len(rows)}
}

// ApplyPayment returns the debt after applying a payment. A non-positive amount
// defaults to the monthly minimum; the debt is marked done once fully repaid.
func ApplyPayment(d model.Debt, amount int64) model.Debt {
	if amount <= 0 {
		amount = d.Monthly
	}
	d.Paid += amount
	if d.Paid >= d.Original {
		d.Paid = d.Original
		d.Done = true
		d.MonthsLeft = 0
	} else if d.MonthsLeft > 0 {
		d.MonthsLeft--
	}
	return d
}
