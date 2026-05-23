package graph

import (
	"context"
	"encoding/json"
	"fmt"

	einotool "github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	"github.com/eino-contrib/jsonschema"

	"github.com/ongridio/ongrid/internal/manager/biz/aiops/tools/basetool"
)

// WrapBaseTool adapts an ongrid basetool.BaseTool to eino's
// components/tool.BaseTool + InvokableTool surface so the eino ToolsNode
// can dispatch to it. PR-3's basetool was deliberately mirror-shaped
// against eino (see basetool.go header comment), so this adapter is
// thin: Info is a 1-1 field copy and InvokableRun forwards the args
// JSON verbatim.
//
// graph 执行层 ToolsNode 接收的是 eino
// tool.BaseTool；本 adapter 是仓库自家 BaseTool 与 eino 之间唯一胶水点。
//
// Per-call options (tenant / user / device id) ride on
// `basetool.InvokeOption` slots; eino's `tool.Option` system carries an
// impl-specific bag for them — see WithInvokeOpts. If the caller does
// not pass any impl-specific options the inner tool runs with its
// decorator-resolved defaults (the typical path).
func WrapBaseTool(t basetool.BaseTool) einotool.InvokableTool {
	if t == nil {
		return nil
	}
	return &einoToolAdapter{inner: t}
}

// einoInvokeOptKey is the internal carrier for ongrid InvokeOptions
// passed through eino's `tool.Option` slot. Unexported so callers
// route through WithInvokeOpts.
type einoInvokeOptKey struct {
	opts []basetool.InvokeOption
}

// WithInvokeOpts is the eino-side option helper that carries
// basetool.InvokeOption into a ToolsNode call. The graph wiring layer
// (PR-N chatruntime) will use this to thread per-request tenant / user
// id through the graph runtime down to each tool's InvokableRun call.
//
// Usage from a graph client:
//
//	runnable.Invoke(ctx, in, compose.WithToolsNodeOption(
//	    compose.WithToolOption(graph.WithInvokeOpts(
//	        basetool.WithUserID(uid),
//	        basetool.WithTenant(tenantID),
//	),
//	)
func WithInvokeOpts(opts ...basetool.InvokeOption) einotool.Option {
	return einotool.WrapImplSpecificOptFn(func(k *einoInvokeOptKey) {
		k.opts = append(k.opts, opts...)
	})
}

// einoToolAdapter wraps a basetool.BaseTool to satisfy eino's
// InvokableTool interface. The struct is intentionally trivial — all
// real behaviour (tenant/audit/timeout/ratelimit/metric) lives in the
// PR-3 decorator chain wrapped *around* the inner tool *before* it
// reaches this adapter.
type einoToolAdapter struct {
	inner basetool.BaseTool
}

// Info returns the eino schema.ToolInfo for this tool. WhenToUse from
// our extended ToolInfo is appended to the description (with a
// "When to use:" prefix) so the LLM sees both halves through the
// standard schema field. — Tool 层 description vs
// when_to_use 拆分。
func (a *einoToolAdapter) Info(ctx context.Context) (*schema.ToolInfo, error) {
	if a == nil || a.inner == nil {
		return nil, fmt.Errorf("graph: tool adapter has nil inner tool")
	}
	info, err := a.inner.Info(ctx)
	if err != nil {
		return nil, err
	}
	if info == nil {
		return nil, fmt.Errorf("graph: tool returned nil ToolInfo")
	}
	desc := info.Description
	if info.WhenToUse != "" {
		if desc != "" {
			desc = desc + "\n\nWhen to use: " + info.WhenToUse
		} else {
			desc = "When to use: " + info.WhenToUse
		}
	}
	out := &schema.ToolInfo{
		Name: info.Name,
		Desc: desc,
	}
	if len(info.Parameters) > 0 {
		// Preserve the existing JSON-Schema bytes verbatim by re-parsing
		// into eino's jsonschema.Schema. PR-3's basetool.ToolInfo carries
		// the schema as raw JSON; eino's ParamsOneOf wants a typed
		// *jsonschema.Schema, so we deserialize. A failure here means the
		// upstream tool produced invalid JSON Schema — bubble it as an
		// error so the graph build refuses to compile.
		js := &jsonschema.Schema{}
		if err := json.Unmarshal(info.Parameters, js); err != nil {
			return nil, fmt.Errorf("graph: tool %q: parse parameters JSON Schema: %w", info.Name, err)
		}
		out.ParamsOneOf = schema.NewParamsOneOfByJSONSchema(js)
	}
	return out, nil
}

// InvokableRun forwards to the inner basetool.BaseTool. Per-call
// InvokeOptions are extracted from the eino tool.Option bag if the
// caller used WithInvokeOpts.
//
// **Tool errors are converted to a JSON envelope, never returned as a
// Go error.** Eino's ToolsNode treats Go-level errors as graph-fatal
// (terminates the whole invoke + SSE stream); ongrid's invariant is
// "tool failures are facts the LLM can recover from" — the LLM should
// see the error text as a tool result and decide to retry / switch /
// ask the user, NOT have the conversation aborted. We mirror what the
// legacy agent.go for-loop did: marshal err into a result-shaped JSON
// like {"error": "..."} so the LLM consumes it as data.
//
// True nil-receiver / unrecoverable bugs (we wrote the wrong inner)
// still surface as Go error so eino can panic-loud, since those are
// not user-fixable.
func (a *einoToolAdapter) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	if a == nil || a.inner == nil {
		return "", fmt.Errorf("graph: tool adapter has nil inner tool")
	}
	resolved := einotool.GetImplSpecificOptions(&einoInvokeOptKey{}, opts...)
	out, err := a.inner.InvokableRun(ctx, argumentsInJSON, resolved.opts...)
	if err != nil {
		// Re-shape as a tool-result-style JSON so the LLM gets it as a
		// message instead of having the graph terminate. Truncate long
		// errors so we don't blow the context window with stack traces.
		msg := err.Error()
		const cap = 2048
		if len(msg) > cap {
			msg = msg[:cap] + "...(truncated)"
		}
		envelope, mErr := json.Marshal(map[string]any{
			"error":  msg,
			"status": "failed",
		})
		if mErr != nil {
			// Marshal of a string + status into a 2-key map should be
			// infallible; if it isn't, fall back to the original error.
			return "", err
		}
		return string(envelope), nil
	}
	return out, nil
}

// WrapBaseTools is the slice-flavoured WrapBaseTool. Returns a slice of
// eino tool.BaseTool ready to feed into compose.ToolsNodeConfig.Tools.
// Nil entries in the input are skipped so callers can pass a sparse
// list (e.g. from a skill activation filter).
func WrapBaseTools(tools []basetool.BaseTool) []einotool.BaseTool {
	out := make([]einotool.BaseTool, 0, len(tools))
	for _, t := range tools {
		if t == nil {
			continue
		}
		out = append(out, WrapBaseTool(t))
	}
	return out
}
