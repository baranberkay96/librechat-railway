# LibreChat Private AI Chat (MongoDB + Meilisearch) — composer spec

| Field | Value |
|---|---|
| Listing name | **LibreChat Private AI Chat (MongoDB + Meilisearch)** — no version label: LibreChat is on 0.x (`v0.8.8`), and the naming rule leaves 0.x labels out of names |
| Description | Self-hosted AI chat for OpenAI, Claude, Gemini, OpenRouter, agents and RAG. (75 chars) |
| Category | AI/ML |
| Tags | librechat, ai-chat, chatgpt-alternative, llm, rag, agents, openai, anthropic |
| Repo | `baranberkay96/librechat-railway` (this folder is the repo root) |
| Upstream checked | LibreChat `v0.8.8` (2026-10-01, the current stable; `v0.8.9-rc1` is a pre-release), rag-api `v0.9.0` (2026-07-31), Meilisearch `v1.56.2` (2026-11-09), MongoDB `8.0.38`, Railway `postgres-ssl:18.6`. Pinned 2026-11-14. |

## Market

| Code | Active / recent deploys | Notes |
|---|---|---|
| `librechat-official` | 3,238 / 570 | LibreChat's own template, linked from its README. Floating `librechat-dev:latest` and `rag-api-dev-lite:latest` (dev builds), `mongo` floating, Meilisearch 1.11.3. Open registration (first visitor becomes ADMIN). RAG API placeholder key. Health 84. |
| `librechat` | 125 / 24 | Same layout; RAG API on a public domain, floating tags, broken `secret(` expressions in several defaults. |
| `HxvQtm` | 42 / 3 | Digest-pinned v0.8.8, no RAG/pgvector wired correctly (RAG on a public URL, no pgvector service). |

## Architecture

```
users ──HTTPS──► LibreChat (Node, :3080, volume /data: uploads, images, temp creds)
                   │  mongodb://  ─► MongoDB 8.0 (users, chats, agents; volume /data/db)
                   │  http://:7700 ─► Meilisearch 1.56 (conversation search; volume /meili_data)
                   └  http://:8000 ─► rag-api v0.9.0 (parsing, embeddings) ─► Postgres 18 + pgvector
```

All traffic between services stays on Railway's private network. Only LibreChat has a public domain.

## Services

| Service | Source | Start | Healthcheck | Volume | Restart |
|---|---|---|---|---|---|
| `LibreChat` | repo `/services/librechat` (`FROM ghcr.io/librechat-ai/librechat:v0.8.8@sha256:5b706bce…`) | image CMD `/app/railway/start.sh` | `/health`, 600 s | `/data` | ALWAYS |
| `MongoDB` | `mongo:8.0.38-noble@sha256:76a93cc3…` | `docker-entrypoint.sh mongod --ipv6 --bind_ip ::,0.0.0.0 --setParameter diagnosticDataCollectionEnabled=false` | — | `/data/db` | ALWAYS |
| `Meilisearch` | `getmeili/meilisearch:v1.56.2@sha256:9600db22…` | key guard, then `/bin/meilisearch` | `/health`, 300 s | `/meili_data` | ALWAYS |
| `rag-api` | `ghcr.io/danny-avila/librechat-rag-api-dev-lite:v0.9.0@sha256:18a8dffa…` | key fallback, then `python main.py` | `/health`, 600 s | — | ALWAYS |
| `Postgres` | `ghcr.io/railwayapp-templates/postgres-ssl:18.6@sha256:4fc833b4…` (pgvector included) | image | — | `/var/lib/postgresql/data` | ALWAYS |

The `rag-api` image comes from the `danny-avila` registry path because `ghcr.io/librechat-ai/librechat-rag-api-dev-lite` has no `v0.9.0` tag.

## LibreChat launcher (`services/librechat/railway/`)

`start.sh` runs as root, then hands over to the `node` user (`as-node.js` drops to uid/gid 1000, no extra packages):

1. **Volume.** `/app/uploads`, `/app/client/public/images`, `/app/data` and `/app/skill` are symlinks (made at build time) into the `/data` volume; the script creates the folders and fixes ownership once (Railway mounts volumes root-owned).
2. **Deploy-form values never fail the deploy** (STANDARD rule 29):
   - `CREDS_KEY` / `CREDS_IV` that are not 64 / 32 hex characters are replaced by the SHA-256 of the given value (stable across restarts) with a warning; LibreChat itself would refuse to start.
   - `MEILI_MASTER_KEY` shorter than 16 characters is replaced by its SHA-256, the same rule as the Meilisearch start command, so both sides agree. Empty key → search off, warning.
   - `MONGO_URI` is built from `MONGO_USER`/`MONGO_PASSWORD`/`MONGO_HOST` with URL encoding, so any password works; a non-empty `MONGO_URI` (e.g. Atlas) wins.
3. **Administrator** (`admin.js`, copied to `/app/config/railway-admin.js`): waits for MongoDB (up to 5 min), then creates `LIBRECHAT_ADMIN_EMAIL` through LibreChat's own `registerUser` (first user → ADMIN, email verified) or, if it exists, ensures the ADMIN role and applies `LIBRECHAT_ADMIN_PASSWORD` when it differs. An invalid email falls back to `admin@example.com`; an invalid password (not 8–128 characters) is not applied — a new admin then gets a random password nobody knows and the log explains how to unlock it. Before the first user is created it records LibreChat's credential fingerprints, as the server does on an empty database.
4. Starts `api/server/index.js` with `NODE_ENV=production`, `HOST=::` (dual-stack), `PORT=3080`.

A baked `librechat.yaml` (config version 1.3.17) adds an OpenRouter custom endpoint (`OPENROUTER_KEY=user_provided`) and a welcome message. `CONFIG_PATH` can point to any other file or URL.

## Variables (LibreChat)

| Variable | Default | Notes |
|---|---|---|
| `LIBRECHAT_ADMIN_EMAIL` | `admin@example.com` | Admin login. |
| `LIBRECHAT_ADMIN_PASSWORD` | `secret(24, alnum)` | Admin password; redeploy applies a new value. |
| `ALLOW_REGISTRATION` | `false` | Public sign-up off. |
| `ALLOW_EMAIL_LOGIN` / `ALLOW_SOCIAL_LOGIN` / `ALLOW_UNVERIFIED_EMAIL_LOGIN` / `ALLOW_PASSWORD_RESET` | `true` / `false` / `true` / `false` | No email service configured. |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_KEY`, `OPENROUTER_KEY` | `user_provided` | Users bring their own keys. |
| `CREDS_KEY` / `CREDS_IV` | `secret(64, hex)` / `secret(32, hex)` | Never rotate. |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | `secret(64, hex)` | `rag-api` references `JWT_SECRET`. |
| `MONGO_HOST` / `MONGO_USER` / `MONGO_PASSWORD` / `MONGO_DATABASE` / `MONGO_URI` | references to `MongoDB`, `LibreChat`, empty | See launcher. |
| `SEARCH`, `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_NO_ANALYTICS` | `true`, private URL, reference, `true` | |
| `RAG_API_URL` | `http://${{rag-api.RAILWAY_PRIVATE_DOMAIN}}:8000` | |
| `DOMAIN_CLIENT` / `DOMAIN_SERVER` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Update for a custom domain. |
| `TRUST_PROXY`, `NO_INDEX`, `APP_TITLE`, `DEBUG_LOGGING`, `ALLOW_SHARED_LINKS(_PUBLIC)` | `1`, `true`, `LibreChat`, `false`, `true`/`false` | |
| `SCHEDULES_SINGLE_PROCESS` | `true` | LibreChat refuses to arm the (beta) scheduled-chats engine without Redis unless told it runs as a single process; this template runs one replica. |
| `PORT` | `3080` | |

**rag-api**: `DB_HOST`/`POSTGRES_DB`/`POSTGRES_USER`/`POSTGRES_PASSWORD` reference `Postgres`; `JWT_SECRET` and `OPENAI_API_KEY` reference LibreChat; `RAG_OPENAI_API_KEY` empty; `EMBEDDINGS_PROVIDER=openai`, `EMBEDDINGS_MODEL=text-embedding-3-small`. The start command uses `RAG_OPENAI_API_KEY`, else LibreChat's `OPENAI_API_KEY` if it is a real key, else a placeholder (the service starts; embeddings fail until a key is set).

**Meilisearch**: `MEILI_ENV=production`, `MEILI_HTTP_ADDR=[::]:7700`, `MEILI_DB_PATH=/meili_data/data.ms`, `MEILI_MASTER_KEY=secret(48, alnum)`, `MEILI_NO_ANALYTICS=true`, `PORT=7700`.

**MongoDB**: Railway base variables; `GLIBC_TUNABLES=glibc.pthread.rseq=1` turns off TCMalloc per-CPU caches, which avoids mongod 8.0's start-up refusal on Linux 6.19–7.0.13 (SERVER-121912, seen in the MongoDB template). It did not change idle RAM measurably.

## Improvements over market templates

| Area | Market | This template |
|---|---|---|
| Versions | `librechat-dev:latest` (dev build), `rag-api-dev-lite:latest`, `mongo` floating | Stable v0.8.8, rag-api v0.9.0, Meilisearch 1.56.2, MongoDB 8.0.38, Postgres 18.6, all by digest |
| First run | Open registration; whoever registers first becomes ADMIN | Admin created at boot with a generated password; registration off |
| Keys | `user_provided` | Same, plus OpenRouter endpoint and automatic RAG key reuse |
| RAG | Placeholder key (official) or RAG on a public domain | Private network only; placeholder only when no real key exists |
| Persistence | No LibreChat volume (uploads and avatars lost on redeploy) | `/data` volume for uploads, images, temp credentials |
| Bad form values | Invalid `CREDS_KEY` or short Meili key stop the deploy | Replaced by stable derived values with a log warning |
| IPv6 | `HOST=0.0.0.0` | `HOST=::` (dual-stack) |

## Resource profile and cost (RAM $10/GB-mo, vCPU $20/mo, volume $0.15/GB-mo)

Measured on Railway, idle after first start (2026-11-14):

| Service | Idle RAM | Typical RAM (small team) | Idle CPU |
|---|---|---|---|
| LibreChat | ~350 MiB | 0.4–0.8 GB | <0.01 |
| MongoDB | ~515 MiB (8 GB limit), ~270 MiB (0.5 GB limit) | 0.3–0.6 GB | <0.01 |
| Meilisearch | ~100–185 MiB | 0.2–0.4 GB | <0.01 |
| rag-api | ~200 MiB | 0.3–0.6 GB (while parsing) | <0.01 |
| Postgres | ~80–120 MiB | 0.1–0.3 GB | <0.01 |

Idle total ≈ 1.3 GB on Hobby ≈ $13–15/month (RAM) plus a few cents of CPU and volumes; a small team ≈ $15–30/month plus model API costs. Plan check: LibreChat (333 MiB) and MongoDB (271 MiB) stayed healthy with a 0.5 GB limit (Free); the other services idle below 0.2 GB. Uploading large PDFs to the RAG API can exceed 0.5 GB on the Free plan.

## Verification checklist

- [x] All 5 services SUCCESS; `/health` 200; `/login` serves the UI.
- [x] Admin login with the generated credentials returns ADMIN; `admin@example.com` with a guessed password is rejected; `/api/auth/register` → 403.
- [x] `/api/search/enable` → true; Meilisearch indexes created; "RAG API is running and reachable" in the LibreChat log.
- [ ] Add your own OpenAI/Anthropic key in the UI and send a message (not done in tests: no real keys used).
- [ ] With `RAG_OPENAI_API_KEY` set, upload a PDF and ask about it.
- [ ] Redeploy LibreChat: avatar and uploaded files persist.

## Open questions

- File chat needs a server-side embeddings key; without it uploads for file search fail (documented).
- LibreChat's beta features (scheduled chats, code workspaces) were not exercised.
