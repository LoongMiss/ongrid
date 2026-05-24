#!/usr/bin/env bash
# ongrid-edge curl-pipe uninstaller.
#
# Usage:
#   curl -k -sSL https://<server>/uninstall.sh | bash
#
# Stops the systemd unit (if present), removes the binary, env file,
# log dir, and the service user. Idempotent — safe to re-run.

set -euo pipefail

INSTALL_DIR="/usr/local/bin"
ENV_FILE="/etc/ongrid-edge/ongrid-edge.env"
SERVICE_FILE="/etc/systemd/system/ongrid-edge.service"
LOG_DIR="/var/log/ongrid-edge"
SERVICE_USER="ongrid-edge"

if [[ $EUID -ne 0 ]]; then
    echo "[INFO] re-executing with sudo"
    exec sudo -E bash "$0" "$@"
fi

# Stop + disable the unit; ignore errors (e.g. unit not installed).
if systemctl list-unit-files | grep -q '^ongrid-edge\.service'; then
    systemctl disable --now ongrid-edge 2>/dev/null || true
fi

# Also stop the bundled exporters (installed alongside edge by
# install-edge.sh). Best-effort — fine if either was never installed.
if systemctl list-unit-files | grep -q '^ongrid-node-exporter\.service'; then
    systemctl disable --now ongrid-node-exporter 2>/dev/null || true
fi
if systemctl list-unit-files | grep -q '^ongrid-process-exporter\.service'; then
    systemctl disable --now ongrid-process-exporter 2>/dev/null || true
fi

rm -f "$SERVICE_FILE" "$INSTALL_DIR/ongrid-edge"
rm -f /etc/systemd/system/ongrid-node-exporter.service
rm -f /etc/systemd/system/ongrid-process-exporter.service
rm -f /usr/local/lib/ongrid-edge/node_exporter
rm -f /usr/local/lib/ongrid-edge/process_exporter
rm -rf "$(dirname "$ENV_FILE")"
rm -rf "$LOG_DIR"

systemctl daemon-reload 2>/dev/null || true

# Remove the dedicated service user (best-effort).
if id -u "$SERVICE_USER" >/dev/null 2>&1; then
    userdel "$SERVICE_USER" 2>/dev/null || true
fi

echo "[OK] ongrid-edge uninstalled"
