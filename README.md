# KStage

The personal k-pop calendar. Follow your favorite groups and see their releases,
music videos, music shows, birthdays, and debut anniversaries in one place — with
optional push notifications, in your own timezone.

Mobile-first PWA. Live: https://kstage.vercel.app

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** · **shadcn/ui** (Base UI primitives underneath — `@base-ui/react`)
- **Supabase** — Postgres + Auth + Row Level Security
- **Vercel** — hosting + Cron · **Web Push** via a hand-written service worker

## Getting started

Prerequisites: Node 20+ and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

All required environment variables are documented in [`.env.example`](./.env.example):
Supabase keys, YouTube Data API key, `CRON_SECRET`, VAPID push keys, and `ADMIN_EMAILS`.

## Scripts

| Script              | Description                      |
| ------------------- | -------------------------------- |
| `npm run dev`       | Start the dev server (Turbopack) |
| `npm run build`     | Production build                 |
| `npm run lint`      | ESLint (strict + jsx-a11y)       |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm run format`    | Prettier write                   |
| `npm run test`      | Unit tests (Vitest)              |
| `npm run test:e2e`  | End-to-end tests (Playwright)    |

> ⚠️ Never leave `npm run dev` running during `npm run test:e2e` — Next 16 refuses a
> second dev server, which makes Playwright's managed server fail.

## Project structure

```
src/app/         Routes (App Router), API cron routes, metadata routes (sitemap, robots, og)
src/components/  UI primitives (ui/) + feature components (auth, home, notifications, suggestions, …)
src/lib/         Domain logic by area: auth, events, follows, groups, notifications,
                 scrapers, suggestions, mocks, and the Supabase clients
src/types/       Generated database types
supabase/        SQL migrations + seed
docs/            Product & planning docs
```

## Data model & sources

8 core tables (see `supabase/migrations/`) with RLS on all user data. Content is hybrid:
~80% automated (YouTube Data API for premieres, `kpopofficial.com` scraping for comebacks,
1–2× per day via Vercel Cron) and ~20% community suggestions, moderated by admins.

## Docs

- [`docs/PROJECT.md`](./docs/PROJECT.md) — product vision, scope, data model, roadmap
- [`AGENTS.md`](./AGENTS.md) — Next.js 16 specifics (breaking changes, gotchas)
- [`docs/BACKLOG.md`](./docs/BACKLOG.md) — deferred / post-MVP ideas
