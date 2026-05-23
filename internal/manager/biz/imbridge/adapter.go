package imbridge

import (
	"context"
	"fmt"

	"github.com/ongridio/ongrid/internal/manager/biz/aiops/agent"
	svcaiops "github.com/ongridio/ongrid/internal/manager/service/aiops"
)

// AiopsServiceAdapter wires the imbridge's AgentSession interface to
// the existing aiops.Service. Both EnsureSession and StreamMessage
// authenticate as a fixed "service account" user (configured at boot)
// until per-IM-user binding lands.
type AiopsServiceAdapter struct {
	svc           *svcaiops.Service
	serviceUserID uint64
}

func NewAiopsAdapter(svc *svcaiops.Service, serviceUserID uint64) *AiopsServiceAdapter {
	return &AiopsServiceAdapter{svc: svc, serviceUserID: serviceUserID}
}

func (a *AiopsServiceAdapter) caller() svcaiops.Caller {
	// Role left blank — backend uses caller.UserID for ownership
	// checks; admin gating doesn't apply on the IM path.
	return svcaiops.Caller{UserID: a.serviceUserID}
}

// EnsureSession just creates a fresh session per inbound thread. We
// don't yet dedupe by label because the bridge already memoises via
// the im_threads table — duplicate calls only happen the first time
// after manager restart, which is acceptable for now.
func (a *AiopsServiceAdapter) EnsureSession(ctx context.Context, ownerUserID uint64, label string) (string, error) {
	caller := a.caller()
	if ownerUserID != 0 {
		caller.UserID = ownerUserID
	}
	sess, err := a.svc.CreateSession(ctx, caller, svcaiops.CreateSessionInput{
		Title: label,
	})
	if err != nil {
		return "", fmt.Errorf("imbridge adapter: create session: %w", err)
	}
	return sess.ID, nil
}

// StreamMessage posts user content to the session and forwards each
// agent.Event to emit. The agent loop runs synchronously on the
// caller's goroutine — the bridge calls this from its own goroutine
// (the webhook handler returns 200 immediately).
func (a *AiopsServiceAdapter) StreamMessage(ctx context.Context, sessionID string, userContent string, emit agent.Emit) error {
	_, err := a.svc.PostMessageStreamWithOpts(ctx, a.caller(), sessionID, userContent, emit, agent.RunOptions{})
	return err
}
