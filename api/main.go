// Command cashflowkub-api is the REST backend for the CashflowKub app.
package main

import (
	"log"

	"github.com/akkaraponph/cashflowkub/api/internal/config"
	"github.com/akkaraponph/cashflowkub/api/internal/database"
	"github.com/akkaraponph/cashflowkub/api/internal/routes"
	"github.com/akkaraponph/cashflowkub/api/internal/seed"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"github.com/gofiber/fiber/v3/middleware/logger"
)

func main() {
	cfg := config.Load()

	db, err := database.Connect(cfg.DatabaseURL, cfg.AppEnv == "development")
	if err != nil {
		log.Fatalf("startup: %v", err)
	}
	if err := database.Migrate(db); err != nil {
		log.Fatalf("startup: %v", err)
	}
	if cfg.SeedOnBoot {
		if err := seed.Run(db); err != nil {
			log.Fatalf("startup: seed: %v", err)
		}
	}

	app := fiber.New(fiber.Config{
		AppName: "cashflowkub-api",
	})
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSOrigins,
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Accept", "Authorization"},
	}))

	routes.Register(app, db)

	addr := ":" + cfg.Port
	log.Printf("cashflowkub-api listening on %s", addr)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("listen: %v", err)
	}
}
