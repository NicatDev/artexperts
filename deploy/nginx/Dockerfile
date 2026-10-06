FROM nginx:1.28-alpine
COPY http.conf https.conf backend-locations.conf proxy-headers.conf /etc/nginx/artexperts/
COPY upstreams.conf /etc/nginx/conf.d/00-upstreams.conf
COPY 05-select-config.sh /docker-entrypoint.d/05-select-config.sh
RUN chmod +x /docker-entrypoint.d/05-select-config.sh
