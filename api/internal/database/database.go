// Package database owns the GORM connection and schema migration.
package database

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/akkaraponph/cashflowkub/api/internal/shared/model"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens a pooled GORM connection to Postgres and verifies it.
func Connect(databaseURL string, debug bool) (*gorm.DB, error) {
	logLevel := logger.Warn
	if debug {
		logLevel = logger.Info
	}

	db, err := gorm.Open(postgres.Open(normalizeDSN(databaseURL)), &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
	})
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(time.Hour)

	if err := sqlDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	log.Println("database: connected")
	return db, nil
}

// Migrate runs AutoMigrate for all models.
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(model.AllModels()...); err != nil {
		return fmt.Errorf("auto migrate: %w", err)
	}
	log.Println("database: migrated")
	return nil
}

// normalizeDSN accepts the common postgresql:// scheme and rewrites it to the
// postgres:// scheme lib/pq expects.
func normalizeDSN(url string) string {
	if strings.HasPrefix(url, "postgresql://") {
		return "postgres://" + strings.TrimPrefix(url, "postgresql://")
	}
	return url
}
