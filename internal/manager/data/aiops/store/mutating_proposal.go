package store

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	model "github.com/ongridio/ongrid/internal/manager/model/aiops"
	"github.com/ongridio/ongrid/internal/pkg/errs"
)

// MutatingProposalRepo is the GORM-backed persistence for
// reviewer audit rows. The decorator package consumes this through a
// narrow interface (decorators.MutatingProposalSink) so tests can
// inject an in-memory fake without standing up a SQLite DB; this file
// is the production binding.
//
// Concurrency: each method runs in its own DB context. Insert at
// intercept time + UpdateDecision at reviewer-return time form the
// canonical write pair; both are independent transactions because the
// reviewer round-trip can outlive an HTTP request.
type MutatingProposalRepo struct {
	db *gorm.DB
}

// NewMutatingProposalRepo constructs the repo around an opened *gorm.DB.
func NewMutatingProposalRepo(db *gorm.DB) *MutatingProposalRepo {
	return &MutatingProposalRepo{db: db}
}

// Insert writes a fresh proposal row in DecisionPending state. ID is
// auto-filled by BeforeCreate when zero.
func (r *MutatingProposalRepo) Insert(ctx context.Context, p *model.MutatingProposal) error {
	if p == nil {
		return errs.ErrInvalid
	}
	if p.Decision == "" {
		p.Decision = model.DecisionPending
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	return r.db.WithContext(ctx).Create(p).Error
}

// UpdateDecision flips the row from pending to approve / reject and
// stamps DecidedAt. ExecutedAt is set lazily by ExecutionStamp once
// the tool actually dispatches (or never, on reject).
func (r *MutatingProposalRepo) UpdateDecision(ctx context.Context, id, decision string, reason *string) error {
	if id == "" {
		return errs.ErrInvalid
	}
	switch decision {
	case model.DecisionApprove, model.DecisionReject:
	default:
		return errs.ErrInvalid
	}
	now := time.Now().UTC()
	res := r.db.WithContext(ctx).Model(&model.MutatingProposal{}).
		Where("id = ?", id).
		Updates(map[string]any{
			"decision":        decision,
			"decision_reason": reason,
			"decided_at":      now,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errs.ErrNotFound
	}
	return nil
}

// MarkExecuted stamps ExecutedAt for the given proposal — fired after
// the wrapped tool's InvokableRun returns (success or failure). Best-
// effort: a missing row should not fail the tool execution.
func (r *MutatingProposalRepo) MarkExecuted(ctx context.Context, id string, t time.Time) error {
	if id == "" {
		return errs.ErrInvalid
	}
	return r.db.WithContext(ctx).Model(&model.MutatingProposal{}).
		Where("id = ?", id).
		Update("executed_at", t.UTC()).Error
}

// Get returns the proposal by id; (nil, errs.ErrNotFound) when missing.
func (r *MutatingProposalRepo) Get(ctx context.Context, id string) (*model.MutatingProposal, error) {
	var p model.MutatingProposal
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&p).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errs.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}
