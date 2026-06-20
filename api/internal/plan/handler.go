package plan

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect). It serves the custom plan/snapshot
// reads; plan-item mutations come from the reference handler in routes.
type Handler struct {
	svc *Service
}

// NewHandler builds a plan HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Plan serves GET /plan with optional ?month=YYYY-MM.
func (h *Handler) Plan(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.ViewPlan(c.Query("month")))
}

// Snapshots serves GET /plan/snapshots.
func (h *Handler) Snapshots(c fiber.Ctx) error {
	return httpx.OK(c, h.svc.ViewSnapshots())
}

// Register mounts the custom plan read routes.
func (h *Handler) Register(g fiber.Router) {
	g.Get("/", h.Plan)
	g.Get("/snapshots", h.Snapshots)
}
