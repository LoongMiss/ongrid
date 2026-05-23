package imbridge

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/ongridio/ongrid/internal/pkg/errs"
	model "github.com/ongridio/ongrid/internal/manager/model/imbridge"
)

// AdminRepo is the surface UC needs from the data layer. The webhook
// + stream paths use the more specific Repo interface; this is a
// superset that includes ImApp CRUD.
type AdminRepo interface {
	Repo
	ListApps(ctx context.Context, provider string) ([]*model.ImApp, error)
	GetApp(ctx context.Context, id uint64) (*model.ImApp, error)
	CreateApp(ctx context.Context, app *model.ImApp) error
	UpdateApp(ctx context.Context, app *model.ImApp) error
	DeleteApp(ctx context.Context, id uint64) error
}

// UC bundles the admin operations consumed by the HTTP handler.
type UC struct {
	repo AdminRepo
}

func NewUC(repo AdminRepo) *UC { return &UC{repo: repo} }

// AppInput is the mutation payload.
type AppInput struct {
	Provider    string
	Mode        string
	Name        string
	AppID       string
	AppSecret   string
	VerifyToken string
	EncryptKey  string
	Enabled     bool
}

func (in *AppInput) validate() error {
	switch strings.ToLower(strings.TrimSpace(in.Provider)) {
	case model.ProviderFeishu, model.ProviderDingTalk:
	default:
		return fmt.Errorf("%w: provider must be feishu or dingtalk", errs.ErrInvalid)
	}
	mode := strings.ToLower(strings.TrimSpace(in.Mode))
	if mode == "" {
		mode = model.ModeStream
	}
	if mode != model.ModeStream && mode != model.ModeWebhook {
		return fmt.Errorf("%w: mode must be stream or webhook", errs.ErrInvalid)
	}
	in.Mode = mode
	if strings.TrimSpace(in.AppID) == "" {
		return fmt.Errorf("%w: app_id required", errs.ErrInvalid)
	}
	if strings.TrimSpace(in.Name) == "" {
		return fmt.Errorf("%w: name required", errs.ErrInvalid)
	}
	// Webhook mode requires encrypt_key for signed/encrypted events;
	// stream mode doesn't. Verify token is optional in both modes.
	if mode == model.ModeWebhook && strings.TrimSpace(in.EncryptKey) == "" {
		return fmt.Errorf("%w: encrypt_key required in webhook mode", errs.ErrInvalid)
	}
	return nil
}

func (uc *UC) ListApps(ctx context.Context, provider string) ([]*model.ImApp, error) {
	return uc.repo.ListApps(ctx, provider)
}

func (uc *UC) GetApp(ctx context.Context, id uint64) (*model.ImApp, error) {
	return uc.repo.GetApp(ctx, id)
}

func (uc *UC) CreateApp(ctx context.Context, in AppInput) (*model.ImApp, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(in.AppSecret) == "" {
		return nil, fmt.Errorf("%w: app_secret required", errs.ErrInvalid)
	}
	now := time.Now().UTC()
	app := &model.ImApp{
		Provider:    in.Provider,
		Mode:        in.Mode,
		Name:        in.Name,
		AppID:       in.AppID,
		AppSecret:   in.AppSecret,
		VerifyToken: in.VerifyToken,
		EncryptKey:  in.EncryptKey,
		Enabled:     in.Enabled,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if err := uc.repo.CreateApp(ctx, app); err != nil {
		return nil, fmt.Errorf("create im_app: %w", err)
	}
	return app, nil
}

// UpdateApp updates the row. Empty AppSecret = keep current (so the
// edit form doesn't have to re-display + re-submit the secret).
func (uc *UC) UpdateApp(ctx context.Context, id uint64, in AppInput) (*model.ImApp, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	cur, err := uc.repo.GetApp(ctx, id)
	if err != nil {
		return nil, err
	}
	cur.Provider = in.Provider
	cur.Mode = in.Mode
	cur.Name = in.Name
	cur.AppID = in.AppID
	if strings.TrimSpace(in.AppSecret) != "" {
		cur.AppSecret = in.AppSecret
	}
	cur.VerifyToken = in.VerifyToken
	cur.EncryptKey = in.EncryptKey
	cur.Enabled = in.Enabled
	cur.UpdatedAt = time.Now().UTC()
	if err := uc.repo.UpdateApp(ctx, cur); err != nil {
		return nil, fmt.Errorf("update im_app: %w", err)
	}
	return cur, nil
}

func (uc *UC) DeleteApp(ctx context.Context, id uint64) error {
	return uc.repo.DeleteApp(ctx, id)
}
