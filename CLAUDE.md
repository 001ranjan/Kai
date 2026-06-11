# Kormoan Agent — Claude Code Guide

## Project overview
TypeScript Express server powering the AI chat agent for kormoan.in. Multi-provider LLM (Claude/OpenAI/Gemini), tool-calling agent that reads live WordPress content, Google Sheets conversation logging, embeddable widget + full-page chat UI.

## Commands
```bash
npm run dev       # Dev with auto-reload
npm run build     # tsc → dist/
npm start         # node dist/index.js
npm run typecheck # tsc --noEmit
```

## Architecture
- **Entry**: `src/index.ts` — Express server, static serving, CORS
- **Agent loop**: `src/agent.ts` — iterates tool calls up to 5× with retry on 503
- **Providers**: `src/providers/` — Claude / OpenAI / Gemini adapters behind a unified `LLMProvider` interface; factory reads `LLM_PROVIDER` env var
- **Tools**: `src/tools/index.ts` (definitions + executor), `src/tools/cache.ts` (WP API fetcher, 5-min TTL)
- **Sessions**: `src/sessions.ts` — in-memory Map, 30-min TTL, auto-cleanup
- **Sheets**: `src/sheets.ts` — service account auth, appends one row per exchange
- **Guardrails**: `src/guardrails.ts` — system prompt with identity rules + CTA close loop

## Environment variables
See `.env.example`. Required: `LLM_PROVIDER`, the matching API key, and optionally Google Sheets creds.

## WordPress endpoints
```
GET /wp-json/ai/v1/all-posts
GET /wp-json/ai/v1/all-pages
GET /wp-json/ai/v1/all-portfolio
GET /wp-json/ai/v1/post/{id}
```
Content is HTML+shortcodes — `cache.ts` strips them with regex. For cleaner data, update the WP plugin to use `apply_filters('the_content', ...)` + `wp_strip_all_tags()`.

## Adding a new tool
1. Add a `ToolDefinition` entry to `TOOL_DEFINITIONS` in `src/tools/index.ts`
2. Add the matching `case` in `executeTool`
3. Add any new fetch/cache logic to `src/tools/cache.ts`
4. Rebuild with `npm run build`

## Adding a new LLM provider
1. Create `src/providers/yourprovider.ts` implementing the `LLMProvider` interface from `src/types.ts`
2. Add a `case` for it in `src/providers/factory.ts`
3. Add the API key env var to `.env.example`

## Key files
| File | Purpose |
|------|---------|
| `src/types.ts` | All shared types — NeutralMessage, ToolDefinition, LLMProvider interface |
| `src/guardrails.ts` | System prompt — edit this to change agent behaviour, tone, CTAs |
| `public/index.html` | Full-page chat UI (self-contained HTML/CSS/JS) |
| `widget/chat.js` | Embeddable widget — update `API_URL` before deploying |
| `.env.example` | All env vars with comments |

## Google Sheets setup
- Enable Google Sheets API in Google Cloud Console
- Create service account → download JSON key
- Share the sheet with the service account email (Editor)
- Set `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` in `.env`
- Headers auto-created on first run: Timestamp | Session ID | Page URL | User Message | Agent Response | Provider | Model

## Deploying
Build first (`npm run build`), then run `npm start`. The server serves:
- `GET /` → chat UI (`public/index.html`)
- `POST /api/chat` → agent endpoint
- `GET /widget/chat.js` → embeddable widget
- `GET /widget/chat.css` → widget styles
- `GET /health` → status check
