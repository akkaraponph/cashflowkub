// Package routes is the HTTP composition root: it builds each domain's
// repository -> service -> handler stack and mounts every endpoint under
// /api/v1, plus a health check. This is the only place that knows the concrete
// wiring; each domain is a single flat package.
package routes

import (
	"github.com/gofiber/fiber/v3"
	"gorm.io/gorm"

	"github.com/akkaraponph/cashflowkub/api/internal/analytics"
	"github.com/akkaraponph/cashflowkub/api/internal/bill"
	"github.com/akkaraponph/cashflowkub/api/internal/debt"
	"github.com/akkaraponph/cashflowkub/api/internal/plan"
	"github.com/akkaraponph/cashflowkub/api/internal/reference"
	"github.com/akkaraponph/cashflowkub/api/internal/setup"
	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"github.com/akkaraponph/cashflowkub/api/internal/transaction"
)

// crud builds a generic reference CRUD handler for model T, ordered by order on
// list (pass "" for none). It serves both the simple resources and the
// create/mutation routes of the custom domains.
func crud[T any](db *gorm.DB, order string) *reference.Handler[T] {
	return reference.NewHandler[T](reference.NewService[T](reference.NewRepository[T](db, order)))
}

// Register mounts all API routes under /api/v1 plus a health check.
func Register(app *fiber.App, db *gorm.DB) {
	app.Get("/health", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "cashflowkub-api"})
	})

	api := app.Group("/api/v1")

	// Simple CRUD reference resources via the generic handler.
	crud[model.Account](db, "sort asc").Register(api.Group("/accounts"))
	crud[model.Category](db, "sort asc").Register(api.Group("/categories"))
	crud[model.Budget](db, "sort asc").Register(api.Group("/budgets"))
	crud[model.Goal](db, "sort asc").Register(api.Group("/goals"))
	crud[model.Asset](db, "sort asc").Register(api.Group("/assets"))
	crud[model.Channel](db, "sort asc").Register(api.Group("/channels"))
	crud[model.IncomeCategory](db, "sort asc").Register(api.Group("/income-categories"))

	// Transactions — custom list/get/create; by-id mutations are generic.
	tx := api.Group("/transactions")
	transaction.NewHandler(transaction.NewService(transaction.NewRepository(db))).Register(tx)
	crud[model.Transaction](db, "").RegisterByIDMutations(tx)

	// Debts — custom list/get/schedule/pay; create + by-id mutations are generic.
	debts := api.Group("/debts")
	debt.NewHandler(debt.NewService(debt.NewRepository(db))).Register(debts)
	debtCRUD := crud[model.Debt](db, "")
	debts.Post("/", debtCRUD.Create)
	debtCRUD.RegisterByIDMutations(debts)

	// Bills — custom list/summary/pay; create + by-id mutations are generic.
	bills := api.Group("/bills")
	bill.NewHandler(bill.NewService(bill.NewRepository(db))).Register(bills)
	billCRUD := crud[model.Bill](db, "")
	bills.Post("/", billCRUD.Create)
	billCRUD.RegisterByIDMutations(bills)

	// Plan — custom reads; plan-item create + by-id mutations are generic.
	planGroup := api.Group("/plan")
	plan.NewHandler(plan.NewService(plan.NewRepository(db))).Register(planGroup)
	crud[model.PlanItem](db, "sort asc").RegisterMutations(planGroup)

	// Aggregate read endpoints mounted directly on the API group.
	analytics.NewHandler(analytics.NewService(analytics.NewRepository(db))).Register(api)
	setup.NewHandler(setup.NewService(setup.NewRepository(db))).Register(api)
}
