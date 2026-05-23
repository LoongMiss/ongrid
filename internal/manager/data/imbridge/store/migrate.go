package store

import (
	"gorm.io/gorm"

	model "github.com/ongridio/ongrid/internal/manager/model/imbridge"
)

// Migrate creates the IM bridge tables — im_apps for platform bot
// credentials, im_threads for the IM-conversation → ongrid-session
// mapping. cmd/ongrid wires this through dbx.RunMigrations at boot.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&model.ImApp{}, &model.ImThread{})
}
