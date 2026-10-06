#!/bin/sh
set -eu
if [ -s /etc/letsencrypt/live/artexperts.net/fullchain.pem ]; then
  cp /etc/nginx/artexperts/https.conf /etc/nginx/conf.d/default.conf
else
  cp /etc/nginx/artexperts/http.conf /etc/nginx/conf.d/default.conf
fi
