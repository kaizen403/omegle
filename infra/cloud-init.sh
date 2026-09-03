#!/bin/bash
set -euxo pipefail

dnf install -y docker
systemctl enable --now docker

COMPOSE_VERSION="2.32.4"
mkdir -p /usr/libexec/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/libexec/docker/cli-plugins/docker-compose
chmod +x /usr/libexec/docker/cli-plugins/docker-compose

mkdir -p /opt/omegle
usermod -aG docker ec2-user || true
