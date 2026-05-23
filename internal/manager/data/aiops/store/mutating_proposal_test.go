package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	model "github.com/ongridio/ongrid/internal/manager/model/aiops"
	"github.com/ongridio/ongrid/internal/pkg/errs"
)

// newProposalRepo opens an in-memory SQLite DB and applies this
// package's Migrate so chat_mutating_proposals exists.
func newProposalRepo(t *testing.T) *MutatingProposalRepo {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("gorm.Open sqlite :memory:: %v", err)
	}
	if err := Migrate(db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return NewMutatingProposalRepo(db)
}

func TestMutatingProposalRepo_InsertDefaults(t *testing.T) {
	repo := newProposalRepo(t)
	ctx := context.Background()

	p := &model.MutatingProposal{
		SessionID:      "sess-1",
		ToolName:       "host_restart_service",
		ArgsJSON:       `{"device_id":1,"service":"nginx"}`,
		ToolClass:      "write",
		ReviewerAgent:  "reviewer",
		ReviewerTaskID: "agent-deadbeef",
		OperatorUserID: 42,
	}
	if err := repo.Insert(ctx, p); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	if p.ID == "" {
		t.Fatalf("expected auto-generated ID")
	}
	if p.Decision != model.DecisionPending {
		t.Errorf("Decision default = %q, want %q", p.Decision, model.DecisionPending)
	}
	if p.CreatedAt.IsZero() {
		t.Errorf("CreatedAt should be auto-stamped")
	}
}

func TestMutatingProposalRepo_DecisionUpdate(t *testing.T) {
	repo := newProposalRepo(t)
	ctx := context.Background()

	p := &model.MutatingProposal{
		SessionID:      "sess-1",
		ToolName:       "host_restart_service",
		ArgsJSON:       `{}`,
		ToolClass:      "write",
		ReviewerAgent:  "reviewer",
		ReviewerTaskID: "agent-1",
	}
	if err := repo.Insert(ctx, p); err != nil {
		t.Fatalf("Insert: %v", err)
	}

	reason := "no SOP found"
	if err := repo.UpdateDecision(ctx, p.ID, model.DecisionReject, &reason); err != nil {
		t.Fatalf("UpdateDecision: %v", err)
	}

	got, err := repo.Get(ctx, p.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Decision != model.DecisionReject {
		t.Errorf("Decision = %q, want reject", got.Decision)
	}
	if got.DecisionReason == nil || *got.DecisionReason != reason {
		t.Errorf("DecisionReason = %v, want %q", got.DecisionReason, reason)
	}
	if got.DecidedAt == nil {
		t.Errorf("DecidedAt should be stamped after update")
	}
}

func TestMutatingProposalRepo_DecisionRejectsInvalidValue(t *testing.T) {
	repo := newProposalRepo(t)
	ctx := context.Background()
	if err := repo.UpdateDecision(ctx, "x", "maybe", nil); !errors.Is(err, errs.ErrInvalid) {
		t.Errorf("invalid decision should return ErrInvalid, got %v", err)
	}
}

func TestMutatingProposalRepo_MarkExecuted(t *testing.T) {
	repo := newProposalRepo(t)
	ctx := context.Background()

	p := &model.MutatingProposal{
		SessionID:      "sess-1",
		ToolName:       "host_restart_service",
		ArgsJSON:       `{}`,
		ToolClass:      "write",
		ReviewerAgent:  "reviewer",
		ReviewerTaskID: "agent-1",
	}
	if err := repo.Insert(ctx, p); err != nil {
		t.Fatalf("Insert: %v", err)
	}
	when := time.Date(2026, 5, 7, 12, 0, 0, 0, time.UTC)
	if err := repo.MarkExecuted(ctx, p.ID, when); err != nil {
		t.Fatalf("MarkExecuted: %v", err)
	}
	got, err := repo.Get(ctx, p.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.ExecutedAt == nil || !got.ExecutedAt.Equal(when) {
		t.Errorf("ExecutedAt = %v, want %v", got.ExecutedAt, when)
	}
}

func TestMutatingProposalRepo_GetMissing(t *testing.T) {
	repo := newProposalRepo(t)
	if _, err := repo.Get(context.Background(), "nonexistent"); !errors.Is(err, errs.ErrNotFound) {
		t.Errorf("missing proposal should return ErrNotFound, got %v", err)
	}
}
