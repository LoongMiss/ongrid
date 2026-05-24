# ongrid

> **Put a lightweight agent on every host, then troubleshoot in natural language — alerts, logs, metrics, traces, topology, and source code, all analyzed together by a cloud AIOps agent**

[![Go Report Card](https://goreportcard.com/badge/github.com/ongridio/ongrid)](https://goreportcard.com/report/github.com/ongridio/ongrid)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Tech](https://img.shields.io/badge/Tech-Go%20%7C%20TypeScript%20%7C%20React-blue)](#%EF%B8%8F-tech-stack)
[![Version](https://img.shields.io/badge/Version-v0.7.138-green)](#)

[简体中文](./README.md) | English

[Quickstart](#-quickstart) • [Overview](#-overview) • [Architecture](#%EF%B8%8F-architecture) • [Contributing](#-contributing)

---

## 📖 Overview

ongrid is an open-source AIOps platform. Install a lightweight `ongrid-edge` agent on each host; it ships metrics, logs, and traces to the cloud over a single multiplexed **outbound** tunnel — no inbound ports on the host. The cloud is an LLM-driven ops agent: you ask in natural language and it goes and runs the PromQL / LogQL / TraceQL, walks the topology, searches the knowledge base, reads source code, and calls read-only host inspection tools to give you a grounded answer.

What it solves:

- **High troubleshooting bar** — "which metric, which logs, which PromQL" is handed to the agent; operators just describe the symptom ("why is this box's load spiking", "who's dropping packets", "what's eating memory").
- **Alerts disconnected from root cause** — on an alert, the agent walks the topology for blast radius, correlates logs/traces, and pins down the **source-code location** that explains the "why".
- **Scattered signals** — metrics (Prometheus), logs (Loki), traces (Tempo), knowledge base (vector search), and source repos are unified and analyzed together in one session.
- **No exposed intranet** — edge dials out; zero inbound ports on hosts; telemetry data plane is separated from the control plane.
- **Self-hostable** — self-managed, one `docker compose` brings up the full stack; point the model at any OpenAI-compatible endpoint.

## ✨ Capabilities

- **Natural-language troubleshooting** — a cloud coordinator agent decomposes the question, dispatches to specialist sub-agents and tools, and returns a conclusion with an evidence chain.
- **Full-stack telemetry** — built-in Prometheus + Loki + Tempo + Grafana; edge collects host metrics / logs / traces.
- **Code-aware analysis** — register source repos and the agent can `list_repo_sources` / `read_source` / `grep_source` to tie log code-locations and stack frames back to real source.
- **Service topology** — BFS blast-radius and node lookup over the topology graph to understand an alert's impact.
- **Knowledge base (RAG)** — built-in ops-playbook baseline + org document upload + vector search; offline ONNX embedder, nothing leaves the box.
- **Alerting engine** — host-threshold alerts plus log/trace-based rules (log_match / log_volume / trace_latency / trace_error_rate).
- **Read-only host tools** — edge exposes policy-constrained read-only inspection (process / network / disk / connections …), called by the agent on demand.
- **Self-managed RBAC** — admin / user / viewer; no public signup, no central auth; the first admin is seeded from env.

## 🚀 Quickstart

### Build from source

```bash
# cloud binary → bin/ongrid, edge → bin/ongrid-edge
make build            # or make build-ongrid / build-ongrid-edge

# frontend SPA
cd web && npm ci && npm run build
```

> The cloud embeds a local ONNX embedder (CGO), so `ongrid` is built with `CGO_ENABLED=1`. `make help` lists every target.

### Run locally (Docker Compose)

```bash
cp deploy/.env.example deploy/.env   # edit as needed (admin account, model key, ...)
make compose-up                      # docker compose -f deploy/docker-compose.yml up -d
make compose-down                    # stop
```

Compose brings up `mysql` / `ongrid` / `frontier` (upstream tunnel broker) / `nginx` / `prometheus` / `grafana`. The first admin is seeded from `ONGRID_ADMIN_EMAIL` / `ONGRID_ADMIN_PASSWORD` in `.env`. See [`deploy/README.md`](deploy/README.md).

### Production deploy

Use the release package + `deploy/install/` (docker-compose or systemd, TLS, upgrade, uninstall) — see [`deploy/install/README.md`](deploy/install/README.md).

### Install edge on a host

edge is a single outbound agent; at install time point `ONGRID_CLOUD_ADDR` at the cloud's tunnel address. It dials out and listens on no inbound port.

## 🏗️ Architecture

```
  hosts ─┐
         │  ongrid-edge (one per host)
         │  · collects metrics / logs / traces
         │  · exposes read-only host inspection tools
         ▼
   ┌─────────── outbound multiplexed tunnel ───────────┐
   ▼                                                    ▼
ongrid (cloud)
  ├─ manager      edge mgmt + telemetry ingest + AIOps agent
  │    └─ coordinator agent ──dispatch──► specialist sub-agents + tools
  │         PromQL · LogQL · TraceQL · topology · RAG search · source reading · host tools
  ├─ telemetry    Prometheus (metrics) · Loki (logs) · Tempo (traces) · Grafana
  ├─ knowledge    vector search (built-in playbooks + org docs) · offline ONNX embedder
  └─ web UI       chat + dashboards
```

### Core components

- **edge (`ongrid-edge`)** — one per host, pure Go, single binary; collects telemetry and exposes read-only inspection tools over the tunnel. Dials out, zero inbound ports.
- **cloud (`ongrid`)** — manager + LLM coordinator. The coordinator dispatches to specialist sub-agents and tools (PromQL / LogQL / TraceQL / topology / knowledge search / source reading) and synthesizes the answer.
- **web** — React SPA: conversational troubleshooting + dashboards.

## 📦 Repo layout

```
cmd/        # ongrid (cloud) + ongrid-edge entrypoints
api/        # proto definitions, grouped by bounded context
internal/
  iam/        # auth / JWT / org / user
  manager/    # edge + telemetry + aiops subdomains
  edgeagent/  # host collection & read-only tool handlers
  pkg/        # shared: tunnel / llm / prom / log / conf ...
web/        # React SPA (chat + dashboards)
agents/     # LLM agent persona definitions
skills/     # agent skill bundles
deploy/     # Dockerfiles / docker-compose / install package (install/)
dist/       # release packaging scripts
```

## 🛠️ Tech stack

| Layer | Choice |
|---|---|
| Cloud | Go · [eino](https://github.com/cloudwego/eino) agent framework · GORM · [geminio](https://github.com/singchia/geminio) tunnel · local ONNX embedder (CGO) |
| Edge | Go (pure Go, single binary, cross-platform) |
| Frontend | TypeScript · React |
| Storage / telemetry | MySQL / SQLite · Prometheus · Loki · Tempo · Grafana · qdrant |
| Model | any OpenAI-compatible endpoint |

## 🤝 Contributing

Issues and PRs welcome. Before submitting, make sure `make build`, `make test`, and `make arch-lint` (enforces bounded-context boundaries) all pass.

## 📄 License

[Apache-2.0](LICENSE).
