package transaction

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/clock"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/result"
	"github.com/samber/mo"
)

// Service is the Orchestration: it pulls rows via the repository (Side Effect),
// stamps "today" from the clock, and builds the pure view shapes.
type Service struct {
	repo Repository
}

// NewService wires the transaction service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ListTransactions returns the filtered list in view shape.
func (s *Service) ListTransactions(f Filter) mo.Result[[]TxView] {
	today := clock.Today()
	return result.Map(s.repo.FindFiltered(f), func(items []model.Transaction) []TxView {
		return FromTxs(items, today)
	})
}

// ViewTransaction returns one transaction in view shape (404 if missing).
func (s *Service) ViewTransaction(id string) mo.Result[TxView] {
	today := clock.Today()
	return result.Map(s.repo.FindByID(id), func(t model.Transaction) TxView {
		return FromTx(t, today)
	})
}

// RecordTransaction builds and stores a transaction, returning its view.
func (s *Service) RecordTransaction(in NewTransaction) mo.Result[TxView] {
	today := clock.Today()
	t := in.Build(today)
	return result.Map(s.repo.Insert(&t), func(saved model.Transaction) TxView {
		return FromTx(saved, today)
	})
}
