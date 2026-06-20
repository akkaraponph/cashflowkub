// Package clock holds the reference "now" the CashflowKub demo is built around.
//
// The design comp is a fixed snapshot, so "today" is a constant rather than the
// real wall clock. Keeping it here (instead of inside seed) lets the pure view
// builders and the orchestration services take "today" as an injected input,
// so every function that derives date-relative labels stays deterministic.
package clock

import "time"

// RefToday is the reference "now" (Jun 18, 2026).
var RefToday = time.Date(2026, time.June, 18, 0, 0, 0, 0, time.UTC)

// CurrentMonth is the active month key used across plan/snapshot tables.
const CurrentMonth = "2026-06"

// Today returns the reference date. It is the single Side-Effect-shaped seam for
// "what day is it" — swap this in tests or wire a real clock without touching
// the pure builders that consume its result.
func Today() time.Time { return RefToday }

// TodayDay returns the day-of-month of the reference date.
func TodayDay() int { return RefToday.Day() }
