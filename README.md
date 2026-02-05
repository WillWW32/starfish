# 🐙 Project Starfish

A powerful, unrestricted personal AI assistant system with iMessage integration and a modern web dashboard.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interfaces                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│    iMessage      │   Web Dashboard  │        REST API           │
│  (BlueBubbles)   │  (Next.js/Vercel)│    (Direct Access)        │
└────────┬─────────┴────────┬─────────┴─────────────┬─────────────┘
         │                  │                       │
         ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Starfish Agent Core                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Agents    │  │   Skills    │  │      Channels           │  │
│  │  (Claude/   │  │ (Browser,   │  │  (iMessage, API,        │  │
│  │   GPT)      │  │  Email,     │  │   Telegram, etc.)       │  │
│  │             │  │  Social)    │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Multi-Agent System**: Create and manage multiple AI agents with different personalities and capabilities
- **Sub-Agent Spawning**: Agents can spawn specialized sub-agents for complex tasks
- **iMessage Integration**: Communicate with your AI via familiar text messaging (BlueBubbles)
- **Unrestricted Outbound**: No rate limits on API calls, email sending, or social posting
- **Browser Automation**: Full Playwright/Puppeteer integration for web automation
- **Email Marketing**: SendGrid/SMTP integration for outbound campaigns
- **Social Media**: Post to Twitter, LinkedIn, and more via APIs or browser automation
- **Visual Dashboard**: Clean Next.js dashboard for agent management
- **JSON Config Editing**: Edit agent configs visually or with Monaco editor
- **Bulk Skill Upload**: Drag-and-drop custom skill files

## Quick Start

### Prerequisites

- Node.js 20+
- Mac with iMessage (for BlueBubbles integration)
- API keys: Anthropic (Claude) and/or OpenAI

### 1. Clone and Setup

```bash
git clone https://github.com/WillWW32/starfish.git
cd starfish

# Setup backend
cd openclaw-fork
npm install
cp .env.example .env
# Edit .env with your API keys

# Setup dashboard
cd ../dashboard
npm install
```

### 2. Configure Environment

Edit `openclaw-fork/.env`:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxx

# Optional - for GPT models
OPENAI_API_KEY=sk-xxx

# Optional - for iMessage
BLUEBUBBLES_URL=http://localhost:1234
BLUEBUBBLES_TOKEN=your-token

# Optional - for email
SENDGRID_API_KEY=SG.xxx
```

### 3. Start Services

```bash
# Terminal 1: Start backend
cd openclaw-fork
npm run dev

# Terminal 2: Start dashboard
cd dashboard
npm run dev
```

- Backend API: http://localhost:3000
- Dashboard: http://localhost:3001

## iMessage Setup (BlueBubbles)

1. Install [BlueBubbles Server](https://bluebubbles.app/) on a Mac with iMessage
2. Enable the REST API in BlueBubbles settings
3. Get your server URL and auth token
4. Add to environment variables or configure in dashboard

Your AI will appear as a regular iMessage contact!

## Project Structure

```
starfish/
├── openclaw-fork/          # Backend agent system
│   ├── src/
│   │   ├── agents/         # Agent management
│   │   ├── skills/         # Skill definitions
│   │   │   └── builtin/    # Built-in skills
│   │   ├── channels/       # Communication adapters
│   │   │   └── adapters/   # BlueBubbles, API, etc.
│   │   ├── api/            # REST API server
│   │   ├── memory/         # Conversation storage
│   │   └── utils/          # Configuration helpers
│   └── package.json
│
├── dashboard/              # Next.js web dashboard
│   ├── src/
│   │   ├── app/            # Pages (agents, skills, chat, etc.)
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Data fetching hooks
│   │   └── lib/            # Utilities
│   └── package.json
│
├── docker-compose.yml      # Docker deployment
└── README.md
```

## API Reference

### Agents

```bash
# List agents
GET /api/agents

# Create agent
POST /api/agents
{ "name": "Assistant", "model": "claude-sonnet-4-5-20250929", "systemPrompt": "..." }

# Update agent
PUT /api/agents/:id

# Delete agent
DELETE /api/agents/:id

# Send message
POST /api/agents/:id/message
{ "content": "Hello!" }

# Spawn sub-agent
POST /api/agents/:id/spawn
{ "name": "Marketing Bot", "description": "Handles social media" }
```

### Skills

```bash
# List skills
GET /api/skills

# Upload skills
POST /api/skills/upload (multipart/form-data)

# Toggle skill
PATCH /api/skills/:id
{ "enabled": true }
```

### Configuration

```bash
# Export all configs
GET /api/configs/export

# Import configs
POST /api/configs/import
```

## Built-in Skills

| Skill | Description |
|-------|-------------|
| `browser` | Navigate, click, type, screenshot, extract content |
| `email` | Send emails via SendGrid or SMTP (single/bulk) |
| `social` | Post via **Typefully** (X/Twitter) or **Publer** (multi-platform). Fallback: direct API or browser |
| `reddit` | Browse, search, comment, post on Reddit with **anti-detect stealth** (human-like delays, fingerprint spoofing) |
| `scraper` | Extract data from websites with pagination |
| `file` | Read, write, manage files |
| `http` | Make HTTP requests to any API |
| `scheduler` | Schedule recurring tasks with cron |

## Reddit Browser Agent

The Reddit skill uses Playwright with stealth/anti-detection features for reliable automation:

- **Human-like behavior**: Random delays, mouse curves, typing variance
- **Anti-fingerprinting**: Spoofed webdriver, plugins, navigator properties
- **Account management**: Store cookies, proxies, fingerprints per account
- **Actions**: Browse subreddits, read posts, search, comment, post, upvote

### Reddit Setup

```bash
# Add account
curl -X POST http://localhost:3000/api/agents/{id}/message \
  -d '{"content": "reddit add_account username=myreddit password=xxx"}'

# Login (stores cookies)
curl -X POST ... -d '{"content": "reddit login account=myreddit"}'

# Browse
curl ... -d '{"content": "reddit browse_subreddit subreddit=technology sort=hot limit=10"}'

# Comment (requires warmed account)
curl ... -d '{"content": "reddit comment postUrl=https://reddit.com/r/.../comments/... content=\"Great post!\""}'
```

### Anti-Detection Tips

1. **Warm up accounts**: Use manually for weeks before automating
2. **Low frequency**: 1-5 comments/posts per day max
3. **Residential proxies**: Configure per account in dashboard
4. **Anti-detect browser** (optional): Nstbrowser, GoLogin, Multilogin for extra stealth

## Deployment

### Vercel (Dashboard)

```bash
cd dashboard
vercel --prod
```

### Railway/Render (Backend)

Deploy `openclaw-fork` with environment variables configured.

### Docker

```bash
docker-compose up -d
```

## Security Notes

- API keys are stored in environment variables, never in code
- Enable `API_KEY` in production to secure the management API
- iMessage integration requires physical access to a Mac
- Rate limiting is intentionally disabled for unrestricted operation

## Contributing

This is a private fork for personal use. Feel free to customize!

## License

MIT License - Based on [OpenClaw](https://github.com/openclaw/openclaw)
