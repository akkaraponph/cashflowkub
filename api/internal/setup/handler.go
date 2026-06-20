package setup

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the HTTP transport (Side Effect).
type Handler struct {
	svc *Service
}

// NewHandler builds a setup HTTP handler.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Setup serves GET /setup.
func (h *Handler) Setup(c fiber.Ctx) error { return httpx.OK(c, h.svc.ViewSetup()) }

// Register mounts the setup endpoint on the given API group.
func (h *Handler) Register(api fiber.Router) {
	api.Get("/setup", h.Setup)
}
