package transaction

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect). It serves the custom read/create
// routes; edit/delete are mounted from the reference handler in routes.
type Handler struct {
	svc *Service
}

// NewHandler builds a transaction HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// List serves GET /transactions with optional filters.
func (h *Handler) List(c fiber.Ctx) error {
	f := Filter{
		Type:     c.Query("type"),
		Category: c.Query("category"),
		Account:  c.Query("account"),
		From:     c.Query("from"),
		To:       c.Query("to"),
		Limit:    fiber.Query[int](c, "limit"),
	}
	return httpx.List(c, h.svc.ListTransactions(f))
}

// Get serves GET /transactions/:id.
func (h *Handler) Get(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.ViewTransaction(c.Params("id")))
}

// Create serves POST /transactions.
func (h *Handler) Create(c fiber.Ctx) error {
	var in NewTransaction
	if err := httpx.Bind(c, &in); err != nil {
		return httpx.BadRequest(c, err)
	}
	return httpx.Created(c, h.svc.RecordTransaction(in))
}

// Register mounts the custom transaction read/create routes.
func (h *Handler) Register(g fiber.Router) {
	g.Get("/", h.List)
	g.Post("/", h.Create)
	g.Get("/:id", h.Get)
}
