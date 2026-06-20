// Package view holds derived read shapes that more than one feature renders.
//
// DebtView and BillView are part of the cross-feature API contract: the debt and
// bill domains return them, and the analytics/setup read models embed them too.
// Keeping the single source of truth here (the shared kernel) means the JSON the
// mobile client sees is identical wherever it appears. Everything here is Pure
// Logic — deterministic functions over model structs, no I/O, no clock access
// (the reference day is passed in).
package view

import "github.com/akkaraponph/cashflowkub/api/internal/shared/model"

// Debt augments a debt with derived progress fields.
type Debt struct {
	model.Debt
	Remaining int64   `json:"remaining"`
	Progress  float64 `json:"progress"` // 0..1 paid / original
}

// FromDebt derives the progress view for a debt.
func FromDebt(d model.Debt) Debt {
	remaining := d.Original - d.Paid
	if remaining < 0 {
		remaining = 0
	}
	var progress float64
	if d.Original > 0 {
		progress = float64(d.Paid) / float64(d.Original)
	}
	return Debt{Debt: d, Remaining: remaining, Progress: progress}
}

// FromDebts maps a slice of debts to their views, preserving order.
func FromDebts(debts []model.Debt) []Debt {
	out := make([]Debt, len(debts))
	for i, d := range debts {
		out[i] = FromDebt(d)
	}
	return out
}

// Bill augments a bill with a derived status relative to the reference day.
type Bill struct {
	model.Bill
	Status   string `json:"status"`   // paid | overdue | dueToday | dueSoon | upcoming
	DaysDiff int    `json:"daysDiff"` // dueDay - today (negative = late)
}

// FromBill derives the status view for a bill. todayDay is the day-of-month of
// the reference "today" (injected so this stays pure).
func FromBill(b model.Bill, todayDay int) Bill {
	diff := b.DueDay - todayDay
	status := "upcoming"
	switch {
	case b.Paid:
		status = "paid"
	case diff < 0:
		status = "overdue"
	case diff == 0:
		status = "dueToday"
	case diff <= 5:
		status = "dueSoon"
	}
	return Bill{Bill: b, Status: status, DaysDiff: diff}
}

// FromBills maps a slice of bills to their views, preserving order.
func FromBills(bills []model.Bill, todayDay int) []Bill {
	out := make([]Bill, len(bills))
	for i, b := range bills {
		out[i] = FromBill(b, todayDay)
	}
	return out
}
