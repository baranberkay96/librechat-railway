#!/bin/sh
# Railway launcher for LibreChat: prepares the /data volume, sanitises deploy-form
# values (a bad value never stops the deploy), creates the administrator, starts LibreChat.
set -u

log() { echo "[railway] $*"; }
derive_hex() { printf '%s' "$1" | sha256sum | cut -c1-"$2"; }
is_hex() { printf '%s' "$1" | grep -Eq "^[0-9a-fA-F]{$2}\$"; }

DATA_DIR=/data
ADMIN_ATTEMPTS=60
ADMIN_RETRY_SECONDS=5

prepare_volume() {
  if ! grep -q " $DATA_DIR " /proc/mounts; then
    log "WARNING: no volume mounted at $DATA_DIR; uploads and avatars are lost on redeploy."
  fi
  mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/images" "$DATA_DIR/app" "$DATA_DIR/skill"
  if [ "$(stat -c %u "$DATA_DIR/uploads")" != "1000" ] || [ "$(stat -c %u "$DATA_DIR")" != "1000" ]; then
    chown -R node:node "$DATA_DIR"
  fi
  chown node:node "$DATA_DIR"/* 2>/dev/null || true
}

sanitize_credentials() {
  if [ -n "${CREDS_KEY:-}" ] && ! is_hex "$CREDS_KEY" 64; then
    log "WARNING: CREDS_KEY must be 64 hex characters; using the SHA-256 of the given value instead."
    CREDS_KEY=$(derive_hex "$CREDS_KEY" 64); export CREDS_KEY
  fi
  if [ -n "${CREDS_IV:-}" ] && ! is_hex "$CREDS_IV" 32; then
    log "WARNING: CREDS_IV must be 32 hex characters; using the SHA-256 of the given value instead."
    CREDS_IV=$(derive_hex "$CREDS_IV" 32); export CREDS_IV
  fi
}

configure_search() {
  # Same rule as the Meilisearch service: keys shorter than 16 bytes are replaced by their SHA-256.
  key="${MEILI_MASTER_KEY:-}"
  if [ -z "$key" ]; then
    log "WARNING: MEILI_MASTER_KEY is empty; conversation search is disabled."
    SEARCH=false; export SEARCH
  elif [ "${#key}" -lt 16 ]; then
    MEILI_MASTER_KEY=$(derive_hex "$key" 64); export MEILI_MASTER_KEY
  fi
}

configure_mongo() {
  if [ -n "${MONGO_URI:-}" ]; then
    return
  fi
  MONGO_URI=$(node -e '
    const v = process.env, e = encodeURIComponent;
    const db = v.MONGO_DATABASE || "LibreChat";
    process.stdout.write(`mongodb://${e(v.MONGO_USER || "")}:${e(v.MONGO_PASSWORD || "")}@${v.MONGO_HOST || "localhost"}:${v.MONGO_PORT || 27017}/${db}?authSource=admin`);
  ')
  export MONGO_URI
}

bootstrap_admin() {
  attempt=1
  while [ "$attempt" -le "$ADMIN_ATTEMPTS" ]; do
    node /app/railway/as-node.js /app/config/railway-admin.js
    rc=$?
    case "$rc" in
      0) return ;;
      1) sleep "$ADMIN_RETRY_SECONDS" ;;
      *) log "Admin bootstrap failed (exit $rc); starting LibreChat anyway."; return ;;
    esac
    attempt=$((attempt + 1))
  done
  log "MongoDB was not reachable for $((ADMIN_ATTEMPTS * ADMIN_RETRY_SECONDS)) s; starting LibreChat anyway."
}

prepare_volume
sanitize_credentials
configure_search
configure_mongo
bootstrap_admin
log "Starting LibreChat on [${HOST}]:${PORT}"
exec node /app/railway/as-node.js /app/api/server/index.js
