// Package hostmetrics is the edge-side `hostmetrics` plugin —
// subprocess `node_exporter` that exposes node_* metrics on a
// configurable listen address (default :9102). Manager-side Prometheus
// scrapes the host:port through the docker bridge (see
// deploy/install/prometheus.yml).
//
// node_exporter is CLI-flag-driven (no config file), so this plugin
// leaves ConfigRender nil and packs all spec into Args.
//
// Spec keys (manager UI Edge → Plugins → hostmetrics → Spec):
//
//	listen_address : string         (default ":9102")
//	collectors_enabled: []string   (optional — passes `--collector.<name>` per entry)
//	collectors_disabled: []string  (optional — passes `--no-collector.<name>` per entry)
//	extra_args     : []string       (optional — appended verbatim)
package hostmetrics

import (
	"fmt"
	"log/slog"
	"path/filepath"

	"github.com/ongridio/ongrid/internal/edgeagent/plugins"
)

// Name is the OTel-aligned plugin name; matches manager's
// PluginNameHostMetrics and the directory key under <workDir>/plugins/.
const Name = "hostmetrics"

// DefaultListenAddress is what we hand to node_exporter when the spec
// doesn't override. 9102 (not 9100) avoids collisions with hosts where
// the ongrid manager container's metrics endpoint already binds 9100
// via docker-proxy.
const DefaultListenAddress = ":9102"

// New constructs the hostmetrics plugin. binDir is where ongrid-edge
// looks for the bundled node_exporter binary (typically
// /usr/local/lib/ongrid-edge); workDir is plugin scratch dir.
func New(binDir, workDir string, log *slog.Logger) plugins.Plugin {
	return plugins.NewSubprocess(plugins.SubprocessOpts{
		Name:    Name,
		Binary:  filepath.Join(binDir, "node_exporter"),
		WorkDir: filepath.Join(workDir, Name),
		// node_exporter is CLI-only. We still set ConfigFile so the
		// supervisor's per-plugin workdir gets created, but render is
		// nil → no file written.
		ConfigFile:   filepath.Join(workDir, Name, "spec.snapshot"),
		ConfigRender: nil,
		Args:         buildArgs,
		Log:          log,
	})
}

func buildArgs(cfg plugins.PluginConfig, _ string) []string {
	listen := stringSpec(cfg, "listen_address", DefaultListenAddress)
	args := []string{
		fmt.Sprintf("--web.listen-address=%s", listen),
	}
	for _, c := range stringSliceSpec(cfg, "collectors_enabled") {
		args = append(args, "--collector."+c)
	}
	for _, c := range stringSliceSpec(cfg, "collectors_disabled") {
		args = append(args, "--no-collector."+c)
	}
	args = append(args, stringSliceSpec(cfg, "extra_args")...)
	return args
}

// stringSpec pulls a string from cfg.Spec; falls back to def.
func stringSpec(cfg plugins.PluginConfig, key, def string) string {
	if cfg.Spec == nil {
		return def
	}
	if v, ok := cfg.Spec[key].(string); ok && v != "" {
		return v
	}
	return def
}

// stringSliceSpec pulls a []string from cfg.Spec. JSON unmarshals into
// []interface{} so we coerce element-wise.
func stringSliceSpec(cfg plugins.PluginConfig, key string) []string {
	if cfg.Spec == nil {
		return nil
	}
	raw, ok := cfg.Spec[key].([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		if s, ok := item.(string); ok {
			out = append(out, s)
		}
	}
	return out
}
