package setup

import (
	"github.com/samber/mo"
)

// Service is the Orchestration: it gathers the configured rows via the read
// repository and assembles them with BuildSetup.
type Service struct {
	repo Repository
}

// NewService wires the setup service to its repository.
func NewService(repo Repository) *Service { return &Service{repo: repo} }

// ViewSetup assembles everything the Financial Setup screen configures.
func (s *Service) ViewSetup() mo.Result[SetupView] {
	cats, err := s.repo.FindCategories().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	incomeSources, err := s.repo.FindIncomeSources().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	channels, err := s.repo.FindChannels().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	accounts, err := s.repo.FindAccounts().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	debts, err := s.repo.FindActiveDebts().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	goals, err := s.repo.FindSetupGoals().Get()
	if err != nil {
		return mo.Err[SetupView](err)
	}
	return mo.Ok(BuildSetup(SetupInput{
		Categories:    cats,
		IncomeSources: incomeSources,
		Channels:      channels,
		Accounts:      accounts,
		ActiveDebts:   debts,
		SetupGoals:    goals,
	}))
}
