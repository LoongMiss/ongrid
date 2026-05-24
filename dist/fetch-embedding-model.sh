#!/usr/bin/env bash
# fetch-embedding-model.sh — pre-cache the BGE-small-zh-v1.5 ONNX model
# into .cache/embedding-models/ so dist/package.sh can bundle it into
# the install tarball. Run once on a host with HuggingFace reach;
# subsequent `make package` runs pick up the cache.
#
# Why a separate script: the model is ~55MB download + ~97MB on disk
# after extraction, slow over CN networks; pinning a build step on
# network is brittle. dist/package.sh warns + skips if not pre-cached.

set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd -- "$SCRIPT_DIR/.." && pwd)
DEST="$REPO_ROOT/.cache/embedding-models"
mkdir -p "$DEST"

log()  { printf '[fetch-emb] %s\n' "$*"; }
warn() { printf '[fetch-emb] warn: %s\n' "$*" >&2; }
die()  { printf '[fetch-emb] error: %s\n' "$*" >&2; exit 1; }

# The bundle layout fastembed-go expects under CacheDir/<EmbeddingModel>/
# is a flat directory of these files. We download them straight from the
# Qdrant fastembed model mirror on HuggingFace (mirrors of the BAAI bge
# weights, pre-quantized to int8 ONNX).
MODEL=fast-bge-small-zh-v1.5
HF_BASE=https://huggingface.co/Qdrant/bge-small-zh-v1.5-onnx-Q/resolve/main
TARGET="$DEST/$MODEL"

# Files fastembed-go reads — verified against an actual cache populated
# by NewFlagEmbedding(BGESmallZH). If upstream renames any of these,
# fastembed will hit "missing file" and we'll see it on first manager
# boot — easy to spot.
FILES=(model_optimized.onnx tokenizer_config.json special_tokens_map.json
       config.json tokenizer.json vocab.txt ort_config.json)

mkdir -p "$TARGET"
for f in "${FILES[@]}"; do
    if [[ -s "$TARGET/$f" ]]; then
        log "$f already present — skipping"
        continue
    fi
    log "fetching $f"
    if ! curl -fL --retry 3 --connect-timeout 15 -o "$TARGET/$f" "$HF_BASE/$f"; then
        warn "failed to fetch $f from $HF_BASE — try ONGRID_HF_MIRROR=https://hf-mirror.com (CN-friendly)"
        if [[ -n "${ONGRID_HF_MIRROR:-}" ]]; then
            alt="${ONGRID_HF_MIRROR%/}/Qdrant/bge-small-zh-v1.5-onnx-Q/resolve/main/$f"
            log "retrying via mirror: $alt"
            curl -fL --retry 3 --connect-timeout 15 -o "$TARGET/$f" "$alt"
        else
            die "no mirror configured + upstream unreachable"
        fi
    fi
done

log "cached $TARGET ($(du -sh "$TARGET" | awk '{print $1}'))"
log "next \`make package\` will bundle this under embeddings/$MODEL/"
