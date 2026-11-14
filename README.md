# Deploy and Host LibreChat with Railway

LibreChat is an open-source AI chat platform with one interface for OpenAI, Anthropic, Google, OpenRouter and many other model providers, plus agents, file chat (RAG), conversation search and multi-user accounts. This community template runs LibreChat v0.8.8 with MongoDB, Meilisearch and a RAG API on Postgres with pgvector.

## About Hosting LibreChat

LibreChat is a Node.js application. It keeps users, conversations, agents and settings in MongoDB, indexes messages in Meilisearch for full-text search, and sends uploaded documents to its RAG API, which stores embeddings in Postgres with pgvector. This template pins every image to a version and digest, generates all secrets, and creates the administrator account on first start, so the instance is never open for a stranger to claim. Uploads and avatars live on a Railway volume. No model keys are needed to deploy: by default every user adds their own API key in the chat interface, and you can switch to shared keys at any time.

## Common Use Cases

- A private ChatGPT-style workspace for a team, with conversations kept in your own database.
- One interface for several providers (OpenAI, Claude, Gemini, OpenRouter models) with per-user keys.
- Agents with tools and MCP servers, shared inside the team.
- Chat with PDFs and other documents through the built-in RAG API.
- A controlled AI entry point for a company, with accounts managed by an administrator.

## Dependencies for LibreChat Hosting

- LibreChat (`ghcr.io/librechat-ai/librechat:v0.8.8`)
- MongoDB 8.0
- Meilisearch 1.56
- LibreChat RAG API (lite) v0.9.0 with Postgres 18 + pgvector
- Model provider API keys (OpenAI, Anthropic, Google, OpenRouter, ...), added by users or by you

### Deployment Dependencies

- LibreChat documentation: https://www.librechat.ai/docs
- Environment variables: https://www.librechat.ai/docs/configuration/dotenv
- librechat.yaml reference: https://www.librechat.ai/docs/configuration/librechat_yaml
- RAG API: https://www.librechat.ai/docs/configuration/rag_api
- LibreChat source: https://github.com/LibreChat-AI/LibreChat
- Meilisearch: https://www.meilisearch.com/docs

### Implementation Details

| Service | Image | Role | Memory (idle, measured) |
|---|---|---|---|
| `LibreChat` | `librechat:v0.8.8` + Railway launcher | Web app and API, volume `/data` | ~0.35 GB |
| `MongoDB` | `mongo:8.0.38` | Users, chats, agents, settings | ~0.15 GB |
| `Meilisearch` | `meilisearch:v1.56.2` | Conversation search | ~0.05 GB |
| `rag-api` | `librechat-rag-api-dev-lite:v0.9.0` | Document parsing and embeddings | ~0.3 GB |
| `Postgres` | `postgres-ssl:18.6` (pgvector) | Vector store for the RAG API | ~0.05 GB |

**First login.** Open the LibreChat domain and sign in with `LIBRECHAT_ADMIN_EMAIL` (default `admin@example.com`) and the generated `LIBRECHAT_ADMIN_PASSWORD`, both on the LibreChat service's Variables tab. The account has the ADMIN role. To use another email, change `LIBRECHAT_ADMIN_EMAIL` before deploying or later (a redeploy creates the new admin). Changing `LIBRECHAT_ADMIN_PASSWORD` and redeploying resets the admin password.

**Accounts.** Public sign-up is off (`ALLOW_REGISTRATION=false`). To onboard a team, set it to `true`, let people register, then set it back to `false`. While sign-up is open, anyone who finds the URL can create an account, so do not leave it open together with shared API keys.

**Model keys.** `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_KEY` and `OPENROUTER_KEY` default to `user_provided`: each user enters their own key from the model menu, and LibreChat stores it encrypted with `CREDS_KEY`. Replace a value with a real key to share it with all users (their usage is then billed to you).

**File chat (RAG).** Embeddings need an OpenAI key on the server: set `RAG_OPENAI_API_KEY` on `rag-api`, or put a real `OPENAI_API_KEY` on LibreChat (the RAG API uses it). Until then, chat works but uploading a file for file search returns an error. Other embedding providers (Azure, Ollama, Hugging Face TEI, Bedrock) are set with `EMBEDDINGS_PROVIDER` and their variables.

**Configuration.** A small `librechat.yaml` is built in (OpenRouter endpoint, welcome text). To use your own, set `CONFIG_PATH` on LibreChat to a raw file URL and redeploy.

**Plans.** Five services, about 0.9 GB RAM in total when idle. Each service fits Railway's Trial (1 GB per service) and Free (0.5 GB per service) limits at idle. For busy teams or large uploads, Hobby or Pro is recommended.

**Scaling.** LibreChat keeps uploads on its volume, so run one replica and give it more memory and CPU as usage grows. MongoDB, Meilisearch and the RAG API scale vertically.

**Pinning and upgrades.** The LibreChat version is the `FROM` line in `services/librechat/Dockerfile` of the template repository; the other images are pinned in the service settings. Read the LibreChat changelog before upgrading. Never change `CREDS_KEY` or `CREDS_IV` after first start, or stored user keys can no longer be decrypted.

### Why Deploy LibreChat on Railway?

Railway runs LibreChat, its databases, search and RAG services together on a private network with HTTPS, volumes and usage-based pricing. You get a private, multi-provider AI chat for your team in one deploy, keep conversations in your own infrastructure, and can grow each service independently.
