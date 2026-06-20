// Package apperr defines sentinel errors shared across domains.
//
// A repository (Side Effect) maps storage-specific failures onto these so the
// HTTP adapter can pick the right status code without importing GORM. The only
// distinction the transport needs is "missing" vs "everything else".
package apperr

import "errors"

// ErrNotFound is returned by repositories when a record does not exist. The HTTP
// adapter maps it to 404; any other error maps to 500.
var ErrNotFound = errors.New("resource not found")

// IsNotFound reports whether err is (or wraps) ErrNotFound.
func IsNotFound(err error) bool { return errors.Is(err, ErrNotFound) }
