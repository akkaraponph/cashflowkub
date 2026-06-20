// Package httpx holds the Fiber response helpers shared by every HTTP adapter.
//
// It is the one place that knows how a mo.Result maps onto an HTTP status: a
// present value is serialized, apperr.ErrNotFound becomes 404, anything else
// becomes 500. Handlers stay declarative — bind, call the use case, hand the
// Result here.
package httpx

import (
	"github.com/akkaraponph/cashflowkub/api/internal/shared/apperr"
	"github.com/gofiber/fiber/v3"
	"github.com/samber/mo"
)

// Bind decodes the request body into out.
func Bind(c fiber.Ctx, out any) error { return c.Bind().Body(out) }

// BadRequest writes a 400 with the error message.
func BadRequest(c fiber.Ctx, err error) error {
	return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
}

// fail maps a domain error onto the right status code.
func fail(c fiber.Ctx, err error) error {
	if apperr.IsNotFound(err) {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "resource not found"})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
}

// OK unwraps res and writes it as 200, or maps the error to its status.
func OK[T any](c fiber.Ctx, res mo.Result[T]) error {
	v, err := res.Get()
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(v)
}

// Created unwraps res and writes it as 201, or maps the error to its status.
func Created[T any](c fiber.Ctx, res mo.Result[T]) error {
	v, err := res.Get()
	if err != nil {
		return fail(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(v)
}

// List unwraps res and writes it wrapped as {"data": [...]}, the list envelope
// every collection endpoint uses.
func List[T any](c fiber.Ctx, res mo.Result[[]T]) error {
	v, err := res.Get()
	if err != nil {
		return fail(c, err)
	}
	return c.JSON(fiber.Map{"data": v})
}

// NoContent writes a 204 after a successful delete, or maps the error.
func NoContent(c fiber.Ctx, res mo.Result[bool]) error {
	if _, err := res.Get(); err != nil {
		return fail(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}
