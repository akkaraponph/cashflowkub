// Package transaction is the transaction domain: a single flat package holding
// its Pure Logic (this file), Orchestration (service.go), and Side Effects
// (repository.go, handler.go). The three function types stay separated by file,
// not by folder.
//
// This file is the Pure Logic: the read view, the date-relative group label, the
// request builder and the list filter. Nothing here touches I/O or the clock —
// "today" is always passed in.
package transaction

import (
	"time"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
)

// TxView is the transaction shape returned to clients: the stored row plus a
// derived human date string and a Today/Yesterday/date group label.
type TxView struct {
	model.Transaction
	Group   string `json:"group"`
	DateStr string `json:"date"`
}

// FromTx derives the view for one transaction relative to today.
func FromTx(t model.Transaction, today time.Time) TxView {
	return TxView{Transaction: t, Group: groupLabel(t.Date, today), DateStr: t.Date.Format("Jan 2, 2006")}
}

// FromTxs maps a slice of transactions to views, preserving order.
func FromTxs(items []model.Transaction, today time.Time) []TxView {
	out := make([]TxView, len(items))
	for i, t := range items {
		out[i] = FromTx(t, today)
	}
	return out
}

// groupLabel buckets a date relative to the reference today.
func groupLabel(date, today time.Time) string {
	y1, m1, d1 := date.Date()
	y2, m2, d2 := today.Date()
	switch {
	case y1 == y2 && m1 == m2 && d1 == d2:
		return "Today"
	case date.Year() == today.AddDate(0, 0, -1).Year() && date.YearDay() == today.AddDate(0, 0, -1).YearDay():
		return "Yesterday"
	default:
		return date.Format("Jan 2")
	}
}

// Filter narrows a transaction list query. Empty fields are ignored.
type Filter struct {
	Type     string // income | expense
	Category string
	Account  string
	From     string // YYYY-MM-DD
	To       string // YYYY-MM-DD
	Limit    int
}

// NewTransaction is the create request. Date may be a "Jan 2, 2006",
// date-only, or RFC3339 string; Amount is signed.
type NewTransaction struct {
	Name   string `json:"name"`
	Cat    string `json:"cat"`
	Acct   string `json:"acct"`
	Amount int64  `json:"amount"`
	Note   string `json:"note"`
	Date   string `json:"date"`
}

// Build turns the request into a Transaction, parsing the supplied date or
// defaulting to today.
func (in NewTransaction) Build(today time.Time) model.Transaction {
	date := today
	if in.Date != "" {
		date = parseFlexDate(in.Date, today)
	}
	return model.Transaction{
		Name: in.Name, CatKey: in.Cat, Account: in.Acct,
		Amount: in.Amount, Note: in.Note, Date: date,
	}
}

func parseFlexDate(s string, fallback time.Time) time.Time {
	for _, layout := range []string{"Jan 2, 2006", "2006-01-02", time.RFC3339} {
		if t, err := time.Parse(layout, s); err == nil {
			return t
		}
	}
	return fallback
}
