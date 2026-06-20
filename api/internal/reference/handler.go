package reference

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/httpx"
	"github.com/gofiber/fiber/v3"
)

// Handler is the generic reference HTTP transport (Side Effect). Update loads the
// record, applies the request body on top, then saves — so fields omitted from
// the body keep their stored value and explicit zero/false values are honored.
type Handler[T any] struct {
	svc *Service[T]
}

// NewHandler builds a reference HTTP handler over the given service.
func NewHandler[T any](svc *Service[T]) *Handler[T] { return &Handler[T]{svc: svc} }

// List returns all records as {"data": [...]}.
func (h *Handler[T]) List(c fiber.Ctx) error { return httpx.List(c, h.svc.List()) }

// Get returns one record by id (404 if missing).
func (h *Handler[T]) Get(c fiber.Ctx) error { return httpx.OK(c, h.svc.View(c.Params("id"))) }

// Create inserts a new record from the JSON body (201).
func (h *Handler[T]) Create(c fiber.Ctx) error {
	var item T
	if err := httpx.Bind(c, &item); err != nil {
		return httpx.BadRequest(c, err)
	}
	return httpx.Created(c, h.svc.Add(&item))
}

// Update loads the record, applies the JSON body, and saves it (404 if missing).
func (h *Handler[T]) Update(c fiber.Ctx) error {
	loaded := h.svc.View(c.Params("id"))
	item, err := loaded.Get()
	if err != nil {
		return httpx.OK(c, loaded) // maps ErrNotFound -> 404, else 500
	}
	if err := httpx.Bind(c, &item); err != nil {
		return httpx.BadRequest(c, err)
	}
	return httpx.OK(c, h.svc.Save(&item))
}

// Delete removes a record by id (204).
func (h *Handler[T]) Delete(c fiber.Ctx) error {
	return httpx.NoContent(c, h.svc.Remove(c.Params("id")))
}

// Register mounts the standard five routes under group g.
func (h *Handler[T]) Register(g fiber.Router) {
	g.Get("/", h.List)
	g.Post("/", h.Create)
	g.Get("/:id", h.Get)
	g.Put("/:id", h.Update)
	g.Patch("/:id", h.Update)
	g.Delete("/:id", h.Delete)
}

// RegisterMutations mounts create + by-id mutations only (no list/get), for
// groups whose read routes are served by a custom handler.
func (h *Handler[T]) RegisterMutations(g fiber.Router) {
	g.Post("/", h.Create)
	h.RegisterByIDMutations(g)
}

// RegisterByIDMutations mounts only PUT/PATCH/DELETE, for groups whose
// list/get/create are custom.
func (h *Handler[T]) RegisterByIDMutations(g fiber.Router) {
	g.Put("/:id", h.Update)
	g.Patch("/:id", h.Update)
	g.Delete("/:id", h.Delete)
}
