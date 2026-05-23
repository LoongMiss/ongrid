// Package server constructs the iam BC's HTTP router and middleware chain.
// It is the only place that imports internal/iam/service.
package server

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/ongridio/ongrid/internal/iam/model"
	"github.com/ongridio/ongrid/internal/iam/service"
	bizaudit "github.com/ongridio/ongrid/internal/manager/biz/audit"
	auditmodel "github.com/ongridio/ongrid/internal/manager/model/audit"
	auditmw "github.com/ongridio/ongrid/internal/manager/server/middleware"
	"github.com/ongridio/ongrid/internal/pkg/errs"
	"github.com/ongridio/ongrid/internal/pkg/tenantctx"
)

// Handler bundles the Service with its logger and exposes chi routers.
type Handler struct {
	svc *service.Service
	log *slog.Logger
}

// NewHandler builds the iam HTTP handler bundle. Callers register routes
// via RegisterPublic / RegisterProtected on a shared chi router so public
// and protected endpoints can share the same URL prefix despite differing
// middleware chains.
func NewHandler(svc *service.Service, log *slog.Logger) *Handler {
	return &Handler{svc: svc, log: log}
}

// RegisterPublic attaches routes that DO NOT require an auth token.
func (h *Handler) RegisterPublic(r chi.Router) {
	r.Post("/v1/auth/login", h.login)
	r.Post("/v1/auth/refresh", h.refresh)
}

// RegisterProtected attaches routes that require a valid JWT. Caller must
// wrap r in the auth middleware.
func (h *Handler) RegisterProtected(r chi.Router) {
	r.Post("/v1/auth/register", h.register)
	r.Get("/v1/self", h.self)
	r.Get("/v1/me", h.me) // Phase-1: enriched self with memberships.
	r.Get("/v1/users", h.listUsers)
	r.Post("/v1/users", h.createUser)
	r.Patch("/v1/users/{id}", h.updateUser)
	r.Patch("/v1/users/{id}/role", h.setRole)
	// Note: PATCH /v1/users/{id}/superuser was retired May 2026 — the
	// system now has a single privilege tier (role=admin). DB column
	// is_superuser is kept for back-compat but no longer exposed.
	r.Patch("/v1/users/{id}/password", h.resetPassword)
	r.Delete("/v1/users/{id}", h.deleteUser)

	// Org CRUD (superuser-only writes; everyone authenticated can read
	// their own list — Phase 1 keeps it simple, refine in Phase 2).
	r.Get("/v1/orgs", h.listOrgs)
	r.Post("/v1/orgs", h.createOrg)
	r.Patch("/v1/orgs/{id}", h.updateOrg)
	r.Delete("/v1/orgs/{id}", h.deleteOrg)
	r.Get("/v1/orgs/{id}/members", h.listOrgMembers)
	r.Post("/v1/orgs/{id}/members", h.addOrgMember)
	r.Patch("/v1/orgs/{id}/members/{user_id}", h.updateOrgMember)
	r.Delete("/v1/orgs/{id}/members/{user_id}", h.removeOrgMember)
}

// ---- DTOs ----

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role,omitempty"`
}

type userDTO struct {
	ID    uint64 `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
}

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginResp struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Role         string `json:"role"`
}

type refreshReq struct {
	RefreshToken string `json:"refresh_token"`
}

type setRoleReq struct {
	Role string `json:"role"`
}

// ---- handlers ----

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var in loginReq
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	// TODO: rate-limit login attempts (per-IP or per-email) before Phase 3.
	pair, err := h.svc.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		// HLD-010: record failed login. UserID stays nil; email comes
		// from request body so we can spot password-spraying patterns.
		auditmw.SetAuditEvent(r, bizaudit.Event{
			Action:       auditmodel.ActionAuthLoginFailed,
			ResourceType: auditmodel.ResourceAuth,
			ResourceID:   in.Email,
			UserEmail:    in.Email,
			Status:       auditmodel.StatusFailure,
			ErrorMessage: err.Error(),
		})
		writeErr(w, err)
		return
	}
	// Successful login no longer audited (operator flagged the row
	// volume — auth_login_failed below stays for security). The
	// resulting JWT carries user_id + email; subsequent mutating
	// actions land audit rows attributed to the right caller via
	// the tenantctx slot.
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		Role:         pair.Role,
	})
}

func (h *Handler) refresh(w http.ResponseWriter, r *http.Request) {
	var in refreshReq
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	pair, err := h.svc.Refresh(r.Context(), in.RefreshToken)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, loginResp{
		AccessToken:  pair.AccessToken,
		RefreshToken: pair.RefreshToken,
		ExpiresIn:    pair.ExpiresIn,
		Role:         pair.Role,
	})
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	var in registerReq
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	u, err := h.svc.Register(r.Context(), in.Email, in.Password, in.Role)
	if err != nil {
		writeErr(w, err)
		return
	}
	auditmw.SetAuditEvent(r, bizaudit.Event{
		Action:       auditmodel.ActionUserCreate,
		ResourceType: auditmodel.ResourceUser,
		ResourceID:   strconv.FormatUint(u.ID, 10),
		ResourceName: u.Email,
		Status:       auditmodel.StatusSuccess,
		Payload:      map[string]any{"role": u.Role},
	})
	writeJSON(w, http.StatusCreated, userDTO{ID: u.ID, Email: u.Email, Role: u.Role})
}

func (h *Handler) self(w http.ResponseWriter, r *http.Request) {
	t, ok := tenantctx.From(r.Context())
	if !ok {
		writeErr(w, errs.ErrUnauthorized)
		return
	}
	u, err := h.svc.GetByID(r.Context(), t.UserID)
	if err != nil {
		writeErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, userDTO{ID: u.ID, Email: u.Email, Role: u.Role})
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	users, err := h.svc.List(r.Context())
	if err != nil {
		writeErr(w, err)
		return
	}
	out := make([]fullUserDTO, 0, len(users))
	for _, u := range users {
		out = append(out, toFullUserDTO(u))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": out, "total": len(out)})
}

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, err := parseID(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeErr(w, err)
		return
	}
	auditmw.SetAuditEvent(r, bizaudit.Event{
		Action:       auditmodel.ActionUserDelete,
		ResourceType: auditmodel.ResourceUser,
		ResourceID:   strconv.FormatUint(id, 10),
		Status:       auditmodel.StatusSuccess,
	})
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) setRole(w http.ResponseWriter, r *http.Request) {
	if !requireAdmin(w, r) {
		return
	}
	id, err := parseID(r)
	if err != nil {
		writeErr(w, err)
		return
	}
	var in setRoleReq
	if err := decode(r, &in); err != nil {
		writeErr(w, err)
		return
	}
	if err := h.svc.SetRole(r.Context(), id, in.Role); err != nil {
		writeErr(w, err)
		return
	}
	auditmw.SetAuditEvent(r, bizaudit.Event{
		Action:       auditmodel.ActionUserUpdate,
		ResourceType: auditmodel.ResourceUser,
		ResourceID:   strconv.FormatUint(id, 10),
		Status:       auditmodel.StatusSuccess,
		Payload:      map[string]any{"field": "role", "new_role": in.Role},
	})
	w.WriteHeader(http.StatusNoContent)
}

// ---- helpers ----

func requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	t, ok := tenantctx.From(r.Context())
	if !ok {
		writeErr(w, errs.ErrUnauthorized)
		return false
	}
	if t.Role != model.RoleAdmin {
		writeErr(w, errs.ErrForbidden)
		return false
	}
	return true
}

func decode(r *http.Request, dst any) error {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return errors.Join(errs.ErrInvalid, err)
	}
	return nil
}

func parseID(r *http.Request) (uint64, error) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		return 0, errors.Join(errs.ErrInvalid, err)
	}
	return id, nil
}

func writeJSON(w http.ResponseWriter, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if body == nil {
		return
	}
	_ = json.NewEncoder(w).Encode(body)
}

func writeErr(w http.ResponseWriter, err error) {
	http.Error(w, err.Error(), errs.HTTPStatus(err))
}
