// Package bill is the bill domain (flat package). This file holds the Pure
// Logic: the month summary and the paid-flag transition. The reference day and
// month are passed in so these stay deterministic.
package bill

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/view"
)

// SummaryView is the GET /bills/summary response: month totals, the next due
// bill, and the daily-spend map for the calendar.
type SummaryView struct {
	Total     int64            `json:"total"`
	Paid      int64            `json:"paid"`
	Remaining int64            `json:"remaining"`
	Count     int              `json:"count"`
	Month     string           `json:"month"`
	Today     int              `json:"today"`
	NextBill  *view.Bill       `json:"nextBill"`
	DaySpend  []model.DaySpend `json:"daySpend"`
}

// BuildSummary totals the bills and picks the first unpaid one as next due.
// bills are expected ordered by due day; todayDay is the reference day-of-month.
func BuildSummary(bills []model.Bill, days []model.DaySpend, todayDay int, month string) SummaryView {
	var total, paid, remaining int64
	var nextBill *view.Bill
	for _, b := range bills {
		total += b.Amount
		if b.Paid {
			paid += b.Amount
			continue
		}
		remaining += b.Amount
		if nextBill == nil {
			v := view.FromBill(b, todayDay)
			nextBill = &v
		}
	}
	return SummaryView{
		Total: total, Paid: paid, Remaining: remaining,
		Count: len(bills), Month: month, Today: todayDay,
		NextBill: nextBill, DaySpend: days,
	}
}

// ApplyPaid returns the bill after setting its paid flag. A nil pointer toggles
// the current value; a non-nil pointer sets it explicitly.
func ApplyPaid(b model.Bill, paid *bool) model.Bill {
	if paid != nil {
		b.Paid = *paid
	} else {
		b.Paid = !b.Paid
	}
	return b
}
