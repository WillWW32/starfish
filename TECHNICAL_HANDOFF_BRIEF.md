# WJ Boone Ecosystem — Technical Handoff Brief
**Date:** February 6, 2026
**Author:** Claude (Cowork session)
**Owner:** Jesse / WJ Boone (jesse@entreartists.com)

---

## ECOSYSTEM OVERVIEW

| Product | URL | Stack | Deploy | Status |
|---------|-----|-------|--------|--------|
| WithJess | withjess.ai | React/Vite/Capacitor | Vercel | Live (iOS + Web) |
| Starfish | starfish-alpha.vercel.app | Next.js 14 + Fastify | Vercel (dash) + Railway (API) | Landing page done, deploy pending |
| God Box | god-box.org | — | — | Live |
| HeartSafe | heartsafe.app | Within WithJess | Vercel | Live |
| REALones | real-ones.app | — | — | Live |
| The Third Mind | withjess.ai/landing-pages/book-free.html | Static HTML | Vercel | Live |
| HOMEScool | homescool.org | — | — | Live |
| PurgeFlow | purgeflow.io | — | — | Live |
| LocalHustle | app.localhustle.org | — | — | Live |
| Divine Paradox | divineparadox.com | — | — | Live |
| Jess Jr | — | — | — | NEEDS WAITLIST URL + Beehiiv |
| BallersCall | — | — | — | Not in sequences yet |
| BirdieBook | — | — | — | Not in sequences yet |
| The Way Up | — | — | — | Not in sequences yet |

---

## CRITICAL CREDENTIALS & IDs

### Supabase (WithJess DB)
- **Project ref:** bkoeznbeunkhclsqzpzl
- **URL:** https://bkoeznbeunkhclsqzpzl.supabase.co
- **Anon key:** In `/sessions/tender-admiring-darwin/mnt/withjess/.env` (VITE_SUPABASE_ANON_KEY)

### Beehiiv (Newsletter)
- **Publication ID:** pub_eb4d5795-772d-4822-be52-02b6b2ef9ac8
- **API Key:** xCD38qnAOGL5fNRGLOyTLVoaMSM2vwLuR03ULggFAFAwdzTFuRBlDSD6O0ij4JLS
- **Automation ID (app signups):** aut_e1177f33-0717-4428-9e04-7ec2279d15a0
- **Trigger:** "Added by API" — fires when Supabase trigger syncs new user
- **Status:** Trial — needs Max upgrade to publish automations
- **Live automation:** Book signup funnel (75% open rate, separate from app signups)

### Starfish Dashboard
- **Admin:** jesse@entreartists.com / Jester#3223#
- **GitHub:** github.com/WillWW32/starfish (main branch)

### API Keys (in .env files)
- **Anthropic:** In withjess/.env (VITE_ANTHROPIC_API_KEY)
- **X.AI Grok:** In withjess/.env (VITE_XAI_API_KEY)
- **Stripe:** In withjess/.env
- **Resend:** In withjess/.env

---

## FILE LOCATIONS MAP

### Starfish — `/Users/wboone/Desktop/Starfish/`
(Mounted at `/sessions/tender-admiring-darwin/mnt/Starfish/`)

```
Starfish/
├── openclaw-fork/                    # Backend (Fastify + TypeScript)
│   ├── src/
│   │   ├── agents/agent.ts           # Core agent class
│   │   ├── agents/manager.ts         # Multi-tenant CRUD
│   │   ├── agents/spawner.ts         # Friend agent creation
│   │   ├── api/server.ts             # Fastify server
│   │   ├── api/routes/auth.ts        # 11 auth endpoints
│   │   ├── api/routes/friends.ts     # Friend management
│   │   ├── auth/authenticator.ts     # TOTP 2FA (speakeasy)
│   │   ├── auth/middleware.ts        # Auth guards
│   │   ├── channels/adapters/api.ts  # REST channel
│   │   ├── channels/adapters/bluebubbles.ts  # iMessage
│   │   ├── db/database.ts            # SQLite schema
│   │   ├── integrations/heygen-api.ts
│   │   ├── integrations/kling-api.ts
│   │   ├── integrations/youtube-api.ts
│   │   ├── skills/builtin/           # 11 skills (browser, email, social, reddit, scraper, file, http, scheduler, heygen, kling, youtube)
│   │   ├── skills/registry.ts
│   │   ├── users/service.ts          # User CRUD + bcrypt
│   │   └── index.ts                  # Bootstrap
│   ├── agent-configs/
│   │   ├── william-ii.json           # Book promoter (reddit, social)
│   │   ├── creative-director.json    # Video production (heygen, kling, youtube)
│   │   └── orchestrator.json         # Team coordinator
│   ├── Dockerfile                    # Multi-stage Node 20 + Playwright
│   ├── railway.json                  # Railway deploy config
│   ├── package.json
│   └── .env.example
│
├── dashboard/                        # Frontend (Next.js 14)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx              # Landing (unauth) or Dashboard (auth)
│   │   │   ├── layout.tsx            # Root: AuthProvider + ProtectedLayout
│   │   │   ├── login/page.tsx        # Login form
│   │   │   ├── campaigns/            # Campaign management
│   │   │   ├── chat/                 # Agent chat interface
│   │   │   ├── settings/             # Configuration
│   │   │   └── skills/               # Skill management
│   │   ├── components/
│   │   │   ├── LandingPage.tsx       # Marketing landing page ★ NEW
│   │   │   ├── ProtectedLayout.tsx   # Auth gate ★ MODIFIED
│   │   │   └── ui/sidebar.tsx
│   │   ├── contexts/AuthContext.tsx   # Auth state
│   │   └── hooks/
│   │       ├── useAgents.ts
│   │       └── useSkills.ts
│   ├── package.json
│   ├── vercel.json
│   └── .env.local
│
├── docker-compose.yml
├── PROGRESS_BRIEF.md
├── CLAUDE_CONTEXT_BRIEF.md
└── starfish-logo.png / .psd
```

### WithJess — `/Users/wboone/withjess/`
(Mounted at `/sessions/tender-admiring-darwin/mnt/withjess/`)

```
withjess/
├── src/
│   ├── components/
│   │   ├── Chat.jsx                  # Main chat UI
│   │   ├── Auth.jsx                  # Authentication
│   │   ├── Journal.jsx               # Journaling
│   │   ├── Onboarding.jsx            # New user flow
│   │   ├── OnboardingSlideshow.jsx
│   │   ├── Settings.jsx
│   │   ├── UpgradeModal.jsx          # Stripe payment
│   │   ├── AdminDashboard.jsx
│   │   ├── KidsMode.jsx
│   │   ├── LandingPage.jsx
│   │   ├── heartsafe/                # Memorial feature (8 components)
│   │   └── ... (20+ components)
│   ├── lib/
│   │   ├── ai.js                     # 63KB — Claude/Grok integration
│   │   ├── jess-soul.js              # 39KB — Personality system
│   │   ├── jess-response-system.js   # 31KB — Response generation
│   │   ├── jess-deep-libraries.js    # 23KB — Knowledge base
│   │   ├── scripture-library.js      # 20KB — Bible verses
│   │   ├── jess-daily-posts.js       # 14KB — Social content
│   │   ├── memory.js                 # Conversation storage
│   │   ├── supabase.js               # DB client
│   │   ├── stripe.js                 # Payment integration
│   │   ├── speech.js                 # Voice chat
│   │   └── ... (15+ modules)
│   ├── emails/
│   │   ├── index.js
│   │   └── templates.js              # Email HTML templates
│   ├── App.jsx
│   └── main.jsx
│
├── api/                              # Vercel serverless functions
│   ├── chat.js                       # Chat endpoint
│   ├── create-checkout.js            # Stripe checkout
│   ├── stripe-webhook.js             # 22KB — Stripe events
│   ├── send-welcome.js               # Welcome email (Resend)
│   ├── send-email.js                 # Transactional email
│   ├── customer-portal.js
│   ├── create-gift-checkout.js
│   ├── redeem-gift.js
│   ├── public-stats.js
│   ├── admin/feedback.js
│   ├── admin/metrics.js
│   └── cron/daily-encouragement.js   # Daily email cron
│
├── supabase/
│   ├── BEEHIIV_SETUP.md              # Newsletter integration docs
│   └── functions/beehiiv-sync/index.ts  # Edge function
│
├── marketing/                        # Strategy docs
│   ├── MASTER_BRIEF.md               # 22KB comprehensive strategy
│   ├── ECOSYSTEM_MAP.md              # 12KB product relationships
│   ├── BOOK_MONETIZATION_STRATEGY.md
│   ├── CONTENT_DRIP_STRUCTURE.md     # Email sequence design
│   ├── DISTRIBUTION_NETWORK.md
│   ├── PAID_TRAFFIC_STRATEGY.md
│   ├── SOCIAL_ACCOUNTS.md            # Social media inventory
│   ├── INFLUENCER_OUTREACH.md
│   └── EXECUTION_PLAN.md
│
├── public/                           # Static assets
├── ios/                              # Capacitor iOS build
├── dist/                             # Production build
├── landing-pages/                    # Static HTML pages
│   └── book-free.html                # Third Mind free book page
├── package.json
├── vite.config.js
├── capacitor.config.json
├── vercel.json
└── .env                              # All API keys
```

---

## WHAT WAS COMPLETED THIS SESSION

### 1. Supabase → Beehiiv Trigger (LIVE)
- SQL trigger `on_auth_user_created_beehiiv` on `auth.users` INSERT
- Uses `pg_net` extension for HTTP POST to Beehiiv API
- Tags new users with `app_signup`
- **Verified working** in Supabase SQL Editor

### 2. Beehiiv Automation — App Signup Sequence (DRAFT)
- Created automation with "Added by API" trigger
- Email #1 written: "Welcome to WithJess — Your free gift inside"
  - Preview: "Get The Third Mind free + what to expect from Jess"
  - Body: Welcome from WJ, Third Mind download link, what to expect
- **Status:** Draft — needs Beehiiv Max plan to publish
- **Remaining:** Emails 2-6 not yet created

### 3. Starfish Landing Page (LOCAL — needs push)
Three files modified/created:

**a. `ProtectedLayout.tsx`** — Added `/` as public route
- Also committed to GitHub web editor (commit b3ef1a5)
- Allows unauthenticated visitors to see landing page at root URL

**b. `page.tsx`** — Conditional rendering
- Also committed to GitHub web editor (commit 0f06b98)
- Shows LandingPage for visitors, Dashboard for authenticated users

**c. `LandingPage.tsx`** — NEW FILE (175 lines)
- Hero: "We Build A.I. Employees for Small Business that Crush It."
- CTA: mailto:jesse@entreartists.com (Inquire Now) + Client Login
- 6 feature cards: Multi-Agent Orchestration, Modular Skills, Channel Adapters, Campaign Engine, Secure by Default, Model Agnostic
- 3-step "How it works": Create Agent → Load Skills → Connect Channels
- Bottom CTA: "Ready to put AI to work for your business?"
- Footer: © 2026 EntreArtists
- **Exists locally but NOT yet pushed to GitHub**

**Git status:** Local branch 1 commit ahead of origin. User offered to `git push` from local machine.

### 4. URL Corrections Documented
- REALones: real-ones.app (not realones.app)
- PurgeFlow: purgeflow.io (not purgeflow.app)
- HOMEScool: homescool.org (not .ai)
- BallersCall (not BalersCall)
- Excluded from sequences: The Way Up, BallersCall, BirdieBook

---

## WHAT'S NEXT (Priority Order per User)

### 1. Push Starfish Landing Page
- User pushes from local: `cd ~/Desktop/Starfish && git push origin main`
- Verify Vercel auto-deploys at starfish-alpha.vercel.app
- Confirm landing page shows for unauthenticated visitors

### 2. Jess Jr Waitlist URL + Beehiiv Connection
- Create waitlist landing page for Jess Jr
- Connect signup to Beehiiv via API (same pattern as WithJess)
- Jess Jr currently has no URL — needs one

### 3. Telegram Channel Adapter
- Build Telegram bot adapter for Starfish
- Wire to agent system so agents can communicate via Telegram
- File: `openclaw-fork/src/channels/adapters/telegram.ts`

### 4. Explainer Videos for Live Apps
- "Shipper explainer" for Starfish landing page
- User wants: "We built the most capable outbound A.I. worker"
- Eventually embed on landing page alongside Calendly link

### 5. Apple Search Ad (9/10 quality score)
- First ad creative for Apple Search Ads
- Target app: WithJess (iOS)

### 6. Future Starfish Vision
- Explainer video on landing page
- Calendly appointment link
- Starfish agent that listens for use case and makes a proposal
- Full Railway backend deployment

### 7. Beehiiv Remaining Work
- Upgrade to Max plan (trial expiring)
- Complete emails 2-6 in app signup automation
- Publish automation once on Max plan

---

## STARFISH ARCHITECTURE DETAILS

### Auth System
- Multi-user with 2FA (TOTP via speakeasy)
- bcrypt password hashing (12 rounds)
- 72-hour session tokens
- Admin-only user creation
- Ownership-based agent isolation

### 3 Configured Agents
| Agent | Model | Skills | Role |
|-------|-------|--------|------|
| William II | claude-sonnet-4-5 | reddit, social, http, scraper, email, scheduler | Book promotion on Reddit |
| Creative Director | claude-sonnet-4-5 | heygen, kling, youtube, http, file, scheduler | Video production + YouTube |
| Orchestrator | claude-sonnet-4-5 | http, email, scheduler | Team coordination + reporting |

### 11 Builtin Skills
browser, email, social, reddit, scraper, file, http, scheduler, heygen, kling, youtube

### API Endpoints (Key ones)
- Auth: 11 endpoints (login, 2FA, CRUD)
- Agents: CRUD + messaging + team-status
- Skills: list, upload, toggle
- Friends: create friend user + agent
- Health: GET /health

### Database: SQLite (WAL mode)
Tables: users, user_sessions, user_permissions, agents, messages

---

## WITHJESS ARCHITECTURE DETAILS

### Key Systems
- **AI:** Claude (primary) + Grok (fallback) via lib/ai.js
- **Personality:** 39KB jess-soul.js + 31KB response system + 23KB knowledge base
- **DB:** Supabase PostgreSQL
- **Auth:** Supabase Auth
- **Payments:** Stripe (web) + StoreKit (iOS)
- **Email:** Resend API
- **Newsletter:** Beehiiv (automated via Supabase trigger)
- **iOS:** Capacitor 5.7.8

### Cron Jobs
- `api/cron/daily-encouragement.js` — Daily faith-based emails to opted-in users

### Stripe Webhook Events Handled
- subscription.created/updated/deleted
- invoice.payment_succeeded
- charge.refunded

---

## GIT STATUS

### Starfish (WillWW32/starfish)
```
Latest commits:
d07f7ad feat: add public landing page for Starfish    ← LOCAL ONLY, needs push
1e27f3f feat: add starfish logo to login page and sidebar
f15c227 feat: wrap layout with AuthProvider + ProtectedLayout
```
- Branch: main
- Remote: github.com/WillWW32/starfish
- Status: 1 commit ahead of origin
- Untracked: CLAUDE_CONTEXT_BRIEF.md, Starfish Backup/, starfish-logo.png/psd

### GitHub Web Editor Commits (already on remote)
- b3ef1a5 — ProtectedLayout.tsx update
- 0f06b98 — page.tsx update
- Note: These are on remote but NOT in local history (committed via web editor). Local has its own commit d07f7ad with all 3 file changes. May need to reconcile.

**IMPORTANT:** The local commit d07f7ad and GitHub web editor commits b3ef1a5/0f06b98 both modify the same files. Before pushing, user should:
```bash
cd ~/Desktop/Starfish
git fetch origin
git rebase origin/main  # or git pull --rebase
git push origin main
```

---

## SESSION CONTEXT NOTES

- User prefers: Short concise replies. Tasks one step at a time. Max efficiency.
- Starfish slogan: "We Build A.I. Employees for Small Business that Crush It."
- Future Starfish copy direction: "We built the most capable outbound A.I. worker"
- User moved Starfish files from withjess/ to Desktop/Starfish during session
- Beehiiv trial expiring — needs upgrade to publish automations
- The live Beehiiv automation (75% open rate) is for book signups, NOT app signups
