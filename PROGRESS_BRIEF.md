# Starfish Build — Progress Brief
**Last Updated:** 2026-02-05
**Repo:** /sessions/tender-admiring-darwin/starfish-build/openclaw-fork/
**GitHub:** https://github.com/WillWW32/starfish
**Status:** Backend build complete — needs git push + Railway deploy + npm install

---

## COMPLETED PHASES

### Phase 1: Repo Clone + Review ✅
- Cloned from GitHub, explored full architecture
- Core: Fastify API, TypeScript, Zod schemas, SQLite memory, 8 builtin skills

### Phase 2: 2FA Multi-User Auth System ✅
**Commit:** `0aac739`

| New File | Purpose |
|----------|---------|
| `src/db/database.ts` | Central SQLite DB — users, sessions, permissions tables, WAL mode |
| `src/auth/authenticator.ts` | TOTP via speakeasy — generateSecret, generateQRCode, setup, verify |
| `src/auth/middleware.ts` | authenticateUser, requireAdmin, requireOwnership middleware |
| `src/users/service.ts` | User CRUD, bcrypt (12 rounds), session tokens (72hr), TOTP enable/disable |
| `src/api/routes/auth.ts` | 11 auth endpoints (login, 2fa, register, users, etc.) |

**Auth Endpoints:**
```
POST /api/auth/login          — Credentials → token (or requires2FA + tempToken)
POST /api/auth/verify-2fa     — tempToken + TOTP code → full session token
GET  /api/auth/me             — Current user info
POST /api/auth/setup-2fa      — Generate secret + QR code
POST /api/auth/confirm-2fa    — Verify first code, enable 2FA
POST /api/auth/disable-2fa    — Disable 2FA (requires current code)
POST /api/auth/logout         — Destroy session
POST /api/auth/change-password — Change password
POST /api/auth/register       — Create user (admin only)
GET  /api/auth/users          — List users (admin only)
DELETE /api/auth/users/:id    — Delete user (admin only)
```

### Phase 3: Multi-Tenancy + Agent System ✅
**Commit:** `b4dd6ba`

| New File | Purpose |
|----------|---------|
| `src/agents/agent.ts` | Core Agent class — Claude + OpenAI tool loops, memory, skill binding |
| `src/agents/manager.ts` | AgentManager with user ownership, DB persistence, permission checks |

**Key features:**
- `agents` table with `owner_id` FK to users
- `getAgentsForUser()` — users see only their agents, admins see all
- `canAccessAgent()` — ownership check on all agent operations
- `GET /api/agents/team-status` — team overview endpoint
- All agent CRUD routes enforce ownership

### Phase 4: Video Production Skills ✅
**Commit:** `a9b055d`

| New File | Purpose |
|----------|---------|
| `src/integrations/heygen-api.ts` | HeyGen v2 API wrapper (avatars, voices, video generation) |
| `src/integrations/kling-api.ts` | Kling AI text2video + image2video |
| `src/integrations/youtube-api.ts` | YouTube Data API v3 with OAuth2 resumable upload |
| `src/skills/builtin/heygen.ts` | Agent tool: create_video, list_avatars, list_voices, get_video_status |
| `src/skills/builtin/kling.ts` | Agent tool: generate_video, get_status |
| `src/skills/builtin/youtube.ts` | Agent tool: upload_video, update_metadata, list_videos, get_analytics, create_playlist, add_to_playlist, list_playlists |

**Registry now has 11 builtin skills.**

### Phase 5: Agent Configs ✅
**Commit:** `03b2c31`

| Config File | Agent | Skills |
|-------------|-------|--------|
| `agent-configs/william-ii.json` | William II — Book promoter | reddit, social, http, scraper, email, scheduler |
| `agent-configs/creative-director.json` | Creative Director — Video production | heygen, kling, youtube, http, file, scheduler |
| `agent-configs/orchestrator.json` | Orchestrator — Team coordinator | http, email, scheduler |

### Phase 6: Friend Agent Spawning ✅
**Commit:** `3ee6874`

| New File | Purpose |
|----------|---------|
| `src/agents/spawner.ts` | Create friend users + spawn agents with custom skill restrictions |
| `src/api/routes/friends.ts` | Admin endpoints for friend management |

**Friend API:**
```
POST  /api/friends                — Create friend user + agent (admin only)
GET   /api/friends                — List all friend agents (admin only)
POST  /api/friends/:userId/agent  — Spawn agent for existing friend
PATCH /api/friends/:agentId/skills — Update allowed skills
```

---

## DATABASE SCHEMA (Full)

```sql
-- Users & Auth
users (id, email, username, password_hash, totp_secret, totp_enabled, is_admin, display_name, created_at, updated_at)
user_sessions (id, user_id, token, expires_at, created_at)
user_permissions (id, user_id, agent_id, permission_type, skill_name, created_at)

-- Agents
agents (id, owner_id, config, status, created_at, updated_at)

-- Memory (per-agent databases)
messages (id, agent_id, channel, role, content, tool_calls, metadata, timestamp)
```

---

## ALL ENV VARS NEEDED

```
# Server
PORT=3000

# Auth
ADMIN_EMAIL=jesse@entreartists.com
ADMIN_PASSWORD=<strong-password>
DB_PATH=./data/starfish.db
JWT_SECRET=<random-string>

# LLM
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>

# Video Production
HEYGEN_API_KEY=<key>
KLING_API_KEY=<key>
YOUTUBE_CLIENT_ID=<google-oauth-client-id>
YOUTUBE_CLIENT_SECRET=<google-oauth-client-secret>
YOUTUBE_REFRESH_TOKEN=<token-from-oauth-flow>

# iMessage (optional)
BLUEBUBBLES_URL=<url>
BLUEBUBBLES_TOKEN=<token>
```

---

## DEPENDENCIES ADDED
```json
"speakeasy": "^2.0.0",
"bcrypt": "^5.1.1",
"qrcode": "^1.5.4",
"@types/speakeasy": "^2.0.10",
"@types/bcrypt": "^5.0.2",
"@types/qrcode": "^1.5.5"
```

---

## DEPLOYMENT CONFIG ✅
- Multi-stage Dockerfile (builder + production)
- railway.json configured for Dockerfile build
- .dockerignore added
- .env.example updated with all new vars
- NOTE: This is a NEW Railway project — don't modify existing OpenClaw project

## NEXT STEPS (For User)

1. **Push to GitHub**: `cd starfish-build && git push origin main`
2. **Create NEW Railway project**: Connect to `WillWW32/starfish` repo, set root directory to `openclaw-fork`
3. **Set env vars** in Railway (see ALL ENV VARS section above)
4. **Add volume**: Mount a persistent volume at `/app/data` for SQLite
5. **Deploy**: Railway auto-deploys on push
6. **Login**: `POST /api/auth/login` with ADMIN_EMAIL/ADMIN_PASSWORD
7. **Setup 2FA**: `/api/auth/setup-2fa` → scan QR → `/api/auth/confirm-2fa`
8. **Create agents**: POST configs from agent-configs/ to `/api/agents`

---

## REMAINING WORK (Next Session)

| Task | Priority |
|------|----------|
| Team dashboard React page (Vercel) | High |
| TypeScript compilation test | High |
| Railway deploy verification | High |
| YouTube OAuth2 one-time setup flow | Medium |
| iMessage channel wiring to agents | Medium |
| Agent memory summarization | Low |
| Campaign management UI | Low |

---

## FILE TREE (New/Modified)

```
openclaw-fork/
├── agent-configs/
│   ├── william-ii.json          ← NEW
│   ├── creative-director.json   ← NEW
│   └── orchestrator.json        ← NEW
├── src/
│   ├── agents/
│   │   ├── agent.ts             ← NEW (core agent + LLM tool loop)
│   │   ├── manager.ts           ← NEW (multi-tenant CRUD)
│   │   └── spawner.ts           ← NEW (friend agent creation)
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.ts          ← NEW (11 auth endpoints)
│   │   │   └── friends.ts       ← NEW (4 friend endpoints)
│   │   └── server.ts            ← MODIFIED (auth + friend routes + ownership)
│   ├── auth/
│   │   ├── authenticator.ts     ← NEW (TOTP)
│   │   └── middleware.ts        ← NEW (auth guards)
│   ├── db/
│   │   └── database.ts          ← NEW (central SQLite)
│   ├── integrations/
│   │   ├── heygen-api.ts        ← NEW
│   │   ├── kling-api.ts         ← NEW
│   │   └── youtube-api.ts       ← NEW
│   ├── skills/
│   │   ├── builtin/
│   │   │   ├── heygen.ts        ← NEW
│   │   │   ├── kling.ts         ← NEW
│   │   │   └── youtube.ts       ← NEW
│   │   └── registry.ts          ← MODIFIED (+3 skills)
│   ├── users/
│   │   └── service.ts           ← NEW (user CRUD)
│   ├── index.ts                 ← MODIFIED (DB init + bootstrap admin)
│   └── types.ts                 ← EXISTING (unchanged)
├── Dockerfile                   ← MODIFIED (multi-stage build)
├── .dockerignore                ← NEW
├── .env.example                 ← MODIFIED (+auth +video vars)
└── package.json                 ← MODIFIED (+3 deps)
```

## QUESTIONS FOR JESS (when back from meeting)

1. **GitHub push**: I can't push from the VM. You'll need to run `git push origin main` from the cloned repo, or give me a GitHub token.
2. **Railway root directory**: When creating the new project, set root directory to `openclaw-fork` since the repo structure has openclaw-fork as a subdirectory.
3. **ANTHROPIC_API_KEY**: Do you have one ready for the Railway env vars? The agents need it to run.
4. **HeyGen/Kling API keys**: Do you have accounts with these services yet? The Creative Director agent needs them.
5. **YouTube OAuth**: This requires a one-time OAuth flow through Google Cloud Console. Want me to walk you through it next session?
6. **Custom domain**: Want a custom domain for the Starfish API (e.g., api.starfish.entreartists.com)?
