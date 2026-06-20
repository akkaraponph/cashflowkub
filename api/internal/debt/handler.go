package debt

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect). It serves the custom
// read/schedule/pay routes; create/edit/delete come from the reference handler.
type Handler struct {
	svc *Service
}

// NewHandler builds a debt HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// List serves GET /debts with optional ?status=active|paid.
func (h *Handler) List(c fiber.Ctx) error {
	return httpx.List(c, h.svc.ListDebts(c.Query("status")))
}

// Get serves GET /debts/:id.
func (h *Handler) Get(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.ViewDebt(c.Params("id")))
}

// Schedule serves GET /debts/:id/schedule.
func (h *Handler) Schedule(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.ViewSchedule(c.Params("id")))
}

// Pay serves POST /debts/:id/pay. Body optional: {"amount": 1523}.
func (h *Handler) Pay(c fiber.Ctx) error {
	var body struct {
		Amount int64 `json:"amount"`
	}
	_ = httpx.Bind(c, &body) // body is optional; defaults to the monthly minimum
	return httpx.OK(c, h.svc.PayDebt(c.Params("id"), body.Amount))
}

// Register mounts the custom debt read/action routes.
func (h *Handler) Register(g fiber.Router) {
	g.Get("/", h.List)
	g.Get("/:id", h.Get)
	g.Get("/:id/schedule", h.Schedule)
	g.Post("/:id/pay", h.Pay)
}
