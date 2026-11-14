# LibreChat v0.8.8 (official image, pinned by digest) plus Railway launch scripts.
ARG LIBRECHAT_IMAGE=ghcr.io/librechat-ai/librechat:v0.8.8@sha256:5b706bcee1ca154a1e2987303aaeca0eb27f97919cccee4bb604226c2f8abf61
FROM ${LIBRECHAT_IMAGE}

# The launcher starts as root to prepare the Railway volume (mounted root-owned at /data),
# then runs LibreChat and the admin bootstrap as the image's `node` user.
USER root
COPY --chmod=0755 railway/ /app/railway/
COPY --chmod=0644 librechat.yaml /app/railway/librechat.yaml
COPY --chmod=0644 railway/admin.js /app/config/railway-admin.js

# Everything LibreChat writes and must keep lives on the single /data volume.
RUN set -eu; \
    for pair in uploads:/app/uploads images:/app/client/public/images app:/app/data skill:/app/skill; do \
      name="${pair%%:*}"; target="${pair#*:}"; \
      rm -rf "$target"; ln -s "/data/$name" "$target"; \
    done

ENV NODE_ENV=production \
    HOST=:: \
    PORT=3080 \
    CONFIG_PATH=/app/railway/librechat.yaml \
    LIBRECHAT_TEMP_CREDENTIALS_PATH=/app/data/.env.temp

WORKDIR /app
EXPOSE 3080
CMD ["/app/railway/start.sh"]
