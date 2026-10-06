#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
email="${1:-info@artexperts.net}"
docker compose config --quiet
docker compose up --build --wait --wait-timeout 180
docker compose --profile certbot run --rm certbot certonly \
  --webroot --webroot-path /var/www/certbot \
  --non-interactive --agree-tos --email "$email" --cert-name artexperts.net \
  -d artexperts.net -d app.artexperts.net
docker compose restart nginx
docker compose up --wait --wait-timeout 60 nginx
docker compose exec -T nginx nginx -t
