#!/usr/bin/env python3
"""Copy local API env into SSM without printing values. Prod keys override local ones."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

REGION = "ap-south-1"
PREFIX = "/omegle/prod"
ACCOUNT = "162668739040"
ROOT = Path(__file__).resolve().parents[1]
LOCAL_ENV = ROOT / "apps/api/.env.development"

KEEP_FROM_LOCAL = {
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "API_KEY",
    "JWT_SECRET",
    "JWT_EXPIRES_IN",
    "TURNSTILE_SECRET_KEY",
    "PORT",
}

PROD = {
    "NODE_ENV": "production",
    "BETTER_AUTH_URL": "https://api.vitap.in",
    "ALLOWED_ORIGINS": ",".join(
        [
            "https://vitap.in",
            "https://www.vitap.in",
            "https://admin.vitap.in",
            "https://omegle-web.pages.dev",
            "https://omegle-admin.pages.dev",
        ]
    ),
    "REDIS_HOST": "redis",
    "REDIS_PORT": "6379",
    "REDIS_TLS": "false",
    "AWS_REGION": REGION,
    "S3_BUCKET": f"omegle-vitap-uploads-{ACCOUNT}",
    "S3_PUBLIC_BASE_URL": f"https://omegle-vitap-uploads-{ACCOUNT}.s3.{REGION}.amazonaws.com",
    "TURN_HOST": "turn.cloudflare.com",
    "TURN_PORT": "3478",
    "TURN_TLS_PORT": "0",
    "TURN_AUTH_SECRET": "unconfigured-cloudflare-turn",
    "TURN_REALM": "omegle",
    "STUN_URLS": "stun:stun.cloudflare.com:3478,stun:stun.l.google.com:19302",
}


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        raise SystemExit(f"missing {path}")
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


def put_parameter(name: str, value: str) -> None:
    subprocess.run(
        [
            "aws",
            "ssm",
            "put-parameter",
            "--region",
            REGION,
            "--name",
            f"{PREFIX}/{name}",
            "--type",
            "SecureString",
            "--value",
            value,
            "--overwrite",
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )


def main() -> None:
    local = parse_env(LOCAL_ENV)
    merged = dict(PROD)
    for key in KEEP_FROM_LOCAL:
        if local.get(key):
            merged[key] = local[key]
    if "JWT_EXPIRES_IN" not in merged:
        merged["JWT_EXPIRES_IN"] = "30m"
    if "PORT" not in merged:
        merged["PORT"] = "8080"

    missing = [key for key in ("DATABASE_URL", "BETTER_AUTH_SECRET", "API_KEY", "JWT_SECRET") if not merged.get(key)]
    if missing:
        raise SystemExit(f"missing required local values: {', '.join(missing)}")

    for key, value in sorted(merged.items()):
        put_parameter(key, value)
        print(f"wrote {PREFIX}/{key} ({len(value)} chars)", file=sys.stderr)

    print(f"ok {len(merged)} parameters", file=sys.stderr)


if __name__ == "__main__":
    main()
