# Kormoan Agent

AI-powered chat agent for [kormoan.in](https://www.kormoan.in) — answers visitor questions about services, case studies, and portfolio using live WordPress content. Built with TypeScript, Express, and multi-provider LLM support.

## Features

- **Multi-provider LLM** — swap between Claude, OpenAI, or Gemini via a single env var
- **Live WordPress data** — fetches real content from the site via custom WP REST API endpoints
- **Tool-enabled agent** — autonomously calls tools to look up posts, pages, portfolio, or search by keyword
- **Conversation logging** — saves every exchange to Google Sheets
- **Embeddable widget** — drop a `<script>` tag into any page, including WordPress
- **Full-page chat UI** — served at `/`, styled to match Kormoan's dark design language
- **Guardrails** — never reveals the underlying LLM; always closes with a CTA (book a call / email)

## Stack

| Layer | Technology |
|-------|-----------|
| Server | Express.js (TypeScript) |
| LLM | Anthropic Claude / OpenAI / Google Gemini |
| Data | WordPress REST API (custom endpoints) |
| Logging | Google Sheets API (service account) |
| Widget | Vanilla JS + CSS (no dependencies) |

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in your API keys (see Configuration below)

# 3. Build & run
npm run build
npm start

# Dev mode (auto-reload)
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to see the chat UI.

## Configuration

Copy `.env.example` to `.env` and fill in the values:

```env
# LLM Provider: claude | openai | gemini
LLM_PROVIDER=claude
LLM_MODEL=claude-sonnet-4-6

# Provider keys (only the one you use is required)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Google Sheets logging
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=your_sheet_id

# Server
PORT=3001
ALLOWED_ORIGINS=https://www.kormoan.in
```

### Model examples

| Provider | Model ID |
|----------|----------|
| Claude   | `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-opus-4-8` |
| OpenAI   | `gpt-4o`, `gpt-4o-mini` |
| Gemini   | `gemini-2.0-flash`, `gemini-1.5-pro` |

## WordPress Setup

The agent reads from three custom endpoints on the WordPress site:

```
/wp-json/ai/v1/all-posts      — blog posts
/wp-json/ai/v1/all-pages      — website pages
/wp-json/ai/v1/all-portfolio  — case studies / portfolio
/wp-json/ai/v1/post/{id}      — single item by ID
```

For cleaner content, update the WordPress plugin to render shortcodes before returning:

```php
'content' => wp_strip_all_tags( apply_filters( 'the_content', $post->post_content ) ),
```

## Google Sheets

1. Create a Google Cloud project and enable the **Google Sheets API**
2. Create a service account and download the JSON key
3. Add `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY` to `.env`
4. Share your Google Sheet with the service account email (Editor access)
5. Add the Sheet ID to `GOOGLE_SHEET_ID`

The agent auto-creates headers on first run:

| Timestamp | Session ID | Page URL | User Message | Agent Response | Provider | Model |

## Embedding on WordPress

After deploying, add this snippet to your WordPress theme (before `</body>`):

```html
<script>
  window.KormoanAgentConfig = {
    apiUrl: 'https://your-server.com/api/chat',
    welcomeMessage: "Hi! I'm Kormoan Agent. How can I help you today?"
  };
</script>
<script src="https://your-server.com/widget/chat.js"></script>
```

## Project Structure

```
src/
├── index.ts              # Express server entry point
├── agent.ts              # Agentic loop (tool calling, retries)
├── guardrails.ts         # System prompt + identity rules
├── sessions.ts           # In-memory session management
├── sheets.ts             # Google Sheets logging
├── types.ts              # Shared TypeScript types
├── providers/
│   ├── claude.ts         # Anthropic adapter
│   ├── openai.ts         # OpenAI adapter
│   ├── gemini.ts         # Google Gemini adapter
│   └── factory.ts        # Creates provider from env
├── tools/
│   ├── index.ts          # Tool definitions + executor
│   └── cache.ts          # WP API fetcher with 5-min cache
└── routes/
    └── chat.ts           # POST /api/chat route

public/
└── index.html            # Full-page chat UI

widget/
├── chat.js               # Embeddable chat widget
└── chat.css              # Widget styles
```

## Available Tools

| Tool | Description |
|------|-------------|
| `fetch_posts` | All blog posts and stories |
| `fetch_pages` | All website pages |
| `fetch_portfolio` | All case studies and portfolio items |
| `fetch_item_details` | Full content of a specific item by ID |
| `search_content` | Keyword search across posts, pages, portfolio |

## Scripts

```bash
npm run dev       # Dev server with auto-reload (ts-node + nodemon)
npm run build     # Compile TypeScript to dist/
npm start         # Run compiled output
npm run typecheck # Type-check without building
```
