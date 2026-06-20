package analytics

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect). It mounts the three aggregate
// read endpoints directly on the API group.
type Handler struct {
	svc *Service
}

// NewHandler builds an analytics HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Dashboard serves GET /dashboard.
func (h *Handler) Dashboard(c fiber.Ctx) error { return httpx.OK(c, h.svc.ViewDashboard()) }

// NetWorth serves GET /networth.
func (h *Handler) NetWorth(c fiber.Ctx) error { return httpx.OK(c, h.svc.ViewNetWorth()) }

// Reports serves GET /reports.
func (h *Handler) Reports(c fiber.Ctx) error { return httpx.OK(c, h.svc.ViewReports()) }

// Register mounts the aggregate endpoints on the given API group.
func (h *Handler) Register(api fiber.Router) {
	api.Get("/dashboard", h.Dashboard)
	api.Get("/networth", h.NetWorth)
	api.Get("/reports", h.Reports)
}
