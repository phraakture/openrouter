# OpenRouter

Self-hosted LLM routing API with an OpenAI-compatible `/chat/completions` endpoint. Routes requests across OpenAI, Anthropic, and Google Gemini providers; tracks per-key credit usage.

## Stack

- Runtime: Bun
- API/backend: Elysia
- Database: PostgreSQL + Prisma
- Frontend: React 19 + Tailwind CSS v4 + shadcn/ui
- Monorepo: Turborepo

## Project structure

```
apps/
  api/          # LLM proxy, port 4000
  backend/      # Auth, API keys, models, payments, port 3000
  frontend/     # Dashboard, port 3001
packages/
  db/           # Prisma schema + client
  ui/           # Shared React components
  eslint-config/
  typescript-config/
```

## Setup

```bash
bun install
```

Create `.env` files:

```env
# packages/db/.env
DATABASE_URL=postgresql://user:password@localhost:5432/openrouter

# apps/backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/openrouter
JWT_SECRET=your-jwt-secret

# apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/openrouter
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

Run migrations:

```bash
cd packages/db
bunx prisma migrate deploy --config prisma.config.ts
```

## Run

```bash
bun dev
```

Or individually:

```bash
turbo dev --filter=backend
turbo dev --filter=frontend
turbo dev --filter=api
```

## API usage

### Non-streaming

```bash
curl http://localhost:4000/api/v1/chat/completions \
  -H "Authorization: Bearer sk-or-v1-yourkey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### Streaming

```bash
curl http://localhost:4000/api/v1/chat/completions \
  -H "Authorization: Bearer sk-or-v1-yourkey" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

Model format: `company/model-name`. Provider selection is random across mapped providers.

## Database schema

- `User` — email/password, credit balance
- `ApiKey` — per-user keys, credit tracking, disabled/deleted flags
- `Company` + `Model` — model catalog
- `Provider` + `ModelProviderMapping` — provider mappings and per-token pricing
- `OnrampTransaction` — credit top-ups
- `Conversation` — request logs

## Credit formula

```
credits = (inputTokens * inputTokenCost + outputTokens * outputTokenCost) / 10
```

## License

MIT
