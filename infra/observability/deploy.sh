#!/usr/bin/env bash
# Deploys the observability stack to the homelab box.
# Bind mounts resolve on the remote filesystem, so config/ is rsynced there first;
# secrets stay in the local gitignored .env and are injected at container create time.
set -euo pipefail
cd "$(dirname "$0")"

REMOTE=jacob@homelab
REMOTE_DIR=/home/jacob/corates/observability

if [[ ! -f .env ]]; then
  echo "Missing .env - copy .env.example and fill it in" >&2
  exit 1
fi

ssh "$REMOTE" mkdir -p "$REMOTE_DIR"
rsync -az --delete config/ "$REMOTE:$REMOTE_DIR/"
docker --context homelab compose --env-file .env up -d --remove-orphans
docker --context homelab compose ps
