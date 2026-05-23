package notify

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRouterSendUsesDefaultChannels(t *testing.T) {
	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("content-type = %q", r.Header.Get("Content-Type"))
		}
		var payload Message
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("decode payload: %v", err)
		}
		if payload.Subject != "CPU high" {
			t.Errorf("subject = %q", payload.Subject)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	router := NewRouter(
		true,
		time.Second,
		[]string{"webhook"},
		NewGenericWebhookSender("webhook", srv.URL+"/notify", "secret", srv.Client()),
	)
	err := router.Send(context.Background(), Message{
		Subject:  "CPU high",
		Severity: SeverityWarning,
		Source:   "alert",
	})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if gotPath != "/notify" {
		t.Errorf("path = %q, want /notify", gotPath)
	}
}

func TestRouterSendUnknownChannel(t *testing.T) {
	router := NewRouter(true, time.Second, []string{"missing"})
	err := router.Send(context.Background(), Message{Subject: "x"})
	if err == nil || !strings.Contains(err.Error(), `channel "missing" not configured`) {
		t.Fatalf("err = %v", err)
	}
}

func TestRouterDisabledDropsMessage(t *testing.T) {
	router := NewRouter(false, time.Second, []string{"missing"})
	err := router.Send(context.Background(), Message{Subject: "x"})
	if err != nil {
		t.Fatalf("Send disabled: %v", err)
	}
}

func TestFeishuSenderSignsPayload(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Errorf("decode payload: %v", err)
		}
		if payload["timestamp"] == "" {
			t.Errorf("timestamp missing")
		}
		if payload["sign"] == "" {
			t.Errorf("sign missing")
		}
		if payload["msg_type"] != "text" {
			t.Errorf("msg_type = %v", payload["msg_type"])
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sender := NewFeishuSender("feishu", srv.URL, "secret", srv.Client())
	err := sender.Send(context.Background(), Message{Subject: "edge offline"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
}

func TestDingTalkSenderSignsURL(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("timestamp") == "" {
			t.Errorf("timestamp query missing")
		}
		if r.URL.Query().Get("sign") == "" {
			t.Errorf("sign query missing")
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	sender := NewDingTalkSender("dingtalk", srv.URL, "secret", srv.Client())
	err := sender.Send(context.Background(), Message{Subject: "edge offline"})
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
}
