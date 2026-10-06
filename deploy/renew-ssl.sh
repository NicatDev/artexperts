#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
before="$(docker compose exec -T nginx sha256sum /etc/letsencrypt/live/artexperts.net/fullchain.pem)"
docker compose --profile certbot run --rm certbot renew --quiet
after="$(docker compose exec -T nginx sha256sum /etc/letsencrypt/live/artexperts.net/fullchain.pem)"
if [ "$before" != "$after" ]; then
  docker compose exec -T nginx nginx -t
  docker compose exec -T nginx nginx -s reload
fi
