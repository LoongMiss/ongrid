// Package sqlite is the GORM-backed persistence layer for the
// installed_skills table — marketplace lock table.
//
// Naming follows the existing convention (manager/data/setting/store,
// manager/data/alert/store, ...): the package is "sqlite" but the
// AutoMigrate call is dialect-agnostic and works on MySQL just as well.
package store

import (
	"gorm.io/gorm"

	model "github.com/ongridio/ongrid/internal/manager/model/marketplace"
)

// Migrate registers the installed_skills table with GORM's AutoMigrate.
// Composed from cmd/ongrid via dbx.RunMigrations like the other BC
// migrations.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&model.InstalledPack{})
}
