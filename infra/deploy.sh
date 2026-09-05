#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
OPS_BUCKET="${OPS_BUCKET:-omegle-vitap-ops-${ACCOUNT_ID}}"
SSM_PATH="${SSM_PATH:-/omegle/prod}"
APP_DIR="${APP_DIR:-/opt/omegle}"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

aws s3 cp "s3://${OPS_BUCKET}/compose.yml" "${APP_DIR}/compose.yml"
aws s3 cp "s3://${OPS_BUCKET}/Caddyfile" "${APP_DIR}/Caddyfile"

umask 077
: > "${APP_DIR}/.env"
IMAGE_URI=""
TUNNEL_TOKEN=""

while IFS=$'\t' read -r name value; do
  key="${name##*/}"
  if [[ "$key" == "IMAGE_URI" ]]; then
    IMAGE_URI="$value"
    continue
  fi
  if [[ "$key" == "CLOUDFLARE_TUNNEL_TOKEN" ]]; then
    TUNNEL_TOKEN="$value"
    continue
  fi
  printf '%s=%s\n' "$key" "$value" >> "${APP_DIR}/.env"
done < <(
  aws ssm get-parameters-by-path \
    --region "$REGION" \
    --path "$SSM_PATH" \
    --recursive \
    --with-decryption \
    --query 'Parameters[].[Name,Value]' \
    --output text
)

if [[ -z "$IMAGE_URI" ]]; then
  echo "IMAGE_URI is missing under ${SSM_PATH}" >&2
  exit 1
fi

aws ecr get-login-password --region "$REGION" \
  | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

export API_IMAGE="$IMAGE_URI"
printf 'API_IMAGE=%s\n' "$IMAGE_URI" > "${APP_DIR}/.image.env"

# With a tunnel, publish Caddy on loopback only: the instance then has no public HTTP
# listener, so the origin cannot be reached directly to bypass Cloudflare, and the
# edge-to-origin hop rides cloudflared's outbound TLS instead of plaintext HTTP.
if [[ -n "$TUNNEL_TOKEN" ]]; then
  CADDY_BIND="127.0.0.1"
else
  CADDY_BIND="0.0.0.0"
  echo "WARNING: no CLOUDFLARE_TUNNEL_TOKEN in SSM; publishing Caddy on 0.0.0.0." >&2
  echo "         The origin is then publicly reachable and the CDN can be bypassed." >&2
  echo "         Set EDGE_SECRET and keep the security group restricted to Cloudflare." >&2
fi
printf 'CADDY_BIND=%s\n' "$CADDY_BIND" >> "${APP_DIR}/.image.env"
# Caddy injects this on reverse_proxy. Copied from the SSM-rendered .env so compose
# substitution can see it without mounting every API secret into the Caddy container.
if grep -q '^EDGE_SECRET=' "${APP_DIR}/.env"; then
  grep '^EDGE_SECRET=' "${APP_DIR}/.env" >> "${APP_DIR}/.image.env"
fi
if grep -q '^LOG_LEVEL=' "${APP_DIR}/.env"; then
  grep '^LOG_LEVEL=' "${APP_DIR}/.env" >> "${APP_DIR}/.image.env"
fi

docker compose --env-file "${APP_DIR}/.image.env" -f "${APP_DIR}/compose.yml" pull
docker compose --env-file "${APP_DIR}/.image.env" -f "${APP_DIR}/compose.yml" up -d --remove-orphans

if [[ -n "$TUNNEL_TOKEN" ]]; then
  docker rm -f cloudflared >/dev/null 2>&1 || true
  docker run -d --name cloudflared --restart unless-stopped --network host \
    cloudflare/cloudflared:latest tunnel --no-autoupdate run --token "$TUNNEL_TOKEN" \
    >/dev/null
  echo "cloudflared started (Caddy bound to 127.0.0.1)"
fi

for _ in $(seq 1 40); do
  if curl -fsS http://127.0.0.1/health >/dev/null; then
    echo "API healthy"
    exit 0
  fi
  sleep 3
done

echo "API did not become healthy" >&2
docker compose --env-file "${APP_DIR}/.image.env" -f "${APP_DIR}/compose.yml" ps >&2
exit 1
