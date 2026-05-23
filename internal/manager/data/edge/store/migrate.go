package store

import (
	"gorm.io/gorm"

	model "github.com/ongridio/ongrid/internal/manager/model/edge"
)

// Migrate registers the manager/edge model with gorm's AutoMigrate. It is
// dialect-agnostic and suitable for both MySQL and SQLite; cmd/ongrid wires
// it through dbx.RunMigrations at startup.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&model.Edge{}, &model.PluginConfig{})
}
