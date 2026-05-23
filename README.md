# ongrid

AIOps SaaS：装一个 `ongrid-edge` 到目标主机，在云端用自然语言即可完成"看负载、查丢包、定位异常进程"的排障。

架构概览见 [`docs/design/HLD-001-ongrid.md`](docs/design/HLD-001-ongrid.md)（含系统图、BC 切分、核心数据流）。

## Quickstart

```bash
# 本地依赖（MySQL 等）
make compose-up

# 跑云端
make run-ongrid

# 另一个终端跑边端
make run-ongrid-edge

# 构建二进制
make build            # 产出 bin/ongrid 与 bin/ongrid-edge

# 测试
make test
make test-race
make lint
make arch-lint        # 校验 BC 边界（iam / manager / edgeagent 不得互 import）
```

全部构建 / 镜像 / 部署动作都走 Makefile —— `make help` 列所有 target。

## Repo 布局（顶层）

```
api/            # proto，按 BC / 子域分组
cmd/            # ongrid / ongrid-edge 入口
internal/
  iam/          # BC 1: 登录 / JWT / Org / User
  manager/      # BC 2: edge + metric + aiops 三子域
  edgeagent/    # BC 3: 边端采集 & tool handler
  pkg/          # 跨 BC 共享：auth / tunnel / llm / prom / log / conf ...
db/migrations/  # SQL 迁移
deploy/         # docker-compose / Dockerfile / helm
docs/           # design / adr / prd / runbooks
test/e2e/
```

## 文档

- 顶层设计：[`docs/design/HLD-001-ongrid.md`](docs/design/HLD-001-ongrid.md)
- ADR：
  - [ADR-001 边端隧道选 geminio](docs/adr/ADR-001-edge-tunnel-geminio.md)
  - [ADR-002 AIOps agent 基于 OpenAI](docs/adr/ADR-002-aiops-agent-openai.md)
  - [ADR-003 租户模型 org + user](docs/adr/ADR-003-tenant-model-org-user.md)
  - [ADR-004 指标存储 MySQL-first](docs/adr/ADR-004-metrics-storage-mysql-first.md)
- 贡献与质量：[`AGENTS.md`](AGENTS.md)

## License

Apache-2.0 — 见 [`LICENSE`](LICENSE)。
