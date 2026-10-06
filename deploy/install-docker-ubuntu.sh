#!/bin/sh
set -eu
# Run as root on a fresh Ubuntu server; installs Docker from its official apt repo.
if [ "$(id -u)" != 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
. /etc/os-release
if [ "$ID" != ubuntu ]; then echo 'This script requires Ubuntu. See DEPLOYMENT.md for other distributions.' >&2; exit 1; fi
apt-get update
apt-get install -y ca-certificates curl git nano openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
