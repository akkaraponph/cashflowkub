package bill

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect). It serves the custom
// list/summary/pay routes; create/edit/delete come from the reference handler.
type Handler struct {
	svc *Service
}

// NewHandler builds a bill HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// List serves GET /bills with optional ?status=paid|unpaid.
func (h *Handler) List(c fiber.Ctx) error {
	return httpx.List(c, h.svc.ListBills(c.Query("status")))
}

// Summary serves GET /bills/summary.
func (h *Handler) Summary(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.Summary())
}

// TogglePaid serves PATCH /bills/:id/pay. Body optional: {"paid": true}.
func (h *Handler) TogglePaid(c fiber.Ctx) error {
	var body struct {
		Paid *bool `json:"paid"`
	}
	_ = httpx.Bind(c, &body) // body is optional; nil toggles the flag
	return httpx.OK(c, h.svc.ToggleBillPaid(c.Params("id"), body.Paid))
}

// Register mounts the custom bill read/action routes.
func (h *Handler) Register(g fiber.Router) {
	g.Get("/", h.List)
	g.Get("/summary", h.Summary)
	g.Patch("/:id/pay", h.TogglePaid)
}
