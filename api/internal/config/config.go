package config

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds runtime configuration loaded from the environment.
type Config struct {
	DatabaseURL string
	Port        string
	AppEnv      string
	CORSOrigins []string
	SeedOnBoot  bool
}

// Load reads configuration from a .env file (if present) and the environment.
func Load() *Config {
	// .env is optional — real environments inject vars directly.
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, relying on process environment")
	}

	cfg := &Config{
		DatabaseURL: getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/cfk_db"),
		Port:        getenv("PORT", "8080"),
		AppEnv:      getenv("APP_ENV", "development"),
		CORSOrigins: splitCSV(getenv("CORS_ORIGINS", "*")),
		SeedOnBoot:  getenv("SEED_ON_BOOT", "true") == "true",
	}
	return cfg
}

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
}
