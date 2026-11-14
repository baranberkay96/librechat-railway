# NOTICE — LibreChat template

This is a community template. It is not affiliated with or endorsed by LibreChat or its maintainers.

## Upstream sources checked (2026-11-14)

| Source | Version / path | License | Use |
|---|---|---|---|
| LibreChat-AI/LibreChat | `v0.8.8`: `deploy-compose.yml`, `docker-compose.yml`, `Dockerfile`, `.env.example`, `librechat.example.yaml` | MIT | Service topology (api, MongoDB, Meilisearch, RAG API, pgvector), variable names, ports, volume paths |
| LibreChat-AI/LibreChat | `v0.8.8`: `api/server/index.js`, `api/server/services/AuthService.js`, `api/strategies/validators.js`, `api/db/connect.js`, `config/create-user.js`, `config/reset-password.js`, `packages/api/src/credentials.ts`, `packages/data-schemas/src/schema/user.ts`, `api/config/paths.js` | MIT | Health route, listen host, first-user ADMIN rule, password limits, credential validation, writable paths |
| LibreChat-AI/rag-api | `v0.9.0`: `Dockerfile.lite`, `main.py`, `app/config.py` | MIT | Start command, embeddings key handling, Postgres variables, health route |
| Meilisearch | `v1.56.2` image configuration | MIT (Community Edition; enterprise features under a separate license) | Start command, master key rules |

`services/librechat/railway/admin.js` follows the approach of LibreChat's own `config/create-user.js` (MIT, Copyright (c) 2026 LibreChat) and calls LibreChat's `registerUser` function inside the image. All other files in this repository were written for this template.

## Market templates reviewed

| Code | Use |
|---|---|
| `librechat-official` (LibreChat's own Railway template) | Reviewed service layout (`user_provided` keys, RAG API placeholder key, Meilisearch on `[::]`). Nothing copied. |
| `librechat` ("Self-Hosted AI Chat with Multi-Provider Support") | Reviewed; RAG API exposed on a public domain, floating tags. Nothing copied. |
| `HxvQtm` | Reviewed digest-pinned images. Nothing copied. |

## Railway base services

`MongoDB` follows `templates/_railway-base/mongo.json` (image pinned to `mongo:8.0.38-noble` by digest). `Postgres` follows `templates/_railway-base/postgres.json` (image pinned to `postgres-ssl:18.6` by digest; this Railway image includes pgvector).

## Runtime images

- `ghcr.io/librechat-ai/librechat:v0.8.8` (MIT)
- `ghcr.io/danny-avila/librechat-rag-api-dev-lite:v0.9.0` (MIT)
- `getmeili/meilisearch:v1.56.2` (Meilisearch Community Edition, MIT; enterprise features are separately licensed and not used)
- `mongo:8.0.38-noble` (MongoDB Server, SSPL)
- `ghcr.io/railwayapp-templates/postgres-ssl:18.6` (PostgreSQL License; pgvector PostgreSQL License)
