# KStage — Plan d'implémentation MVP

> **Pour les agents :** SKILL REQUISE — utiliser `superpowers:subagent-driven-development` (recommandé) ou `superpowers:executing-plans` pour exécuter tâche par tâche. Étapes en `- [ ]` pour le tracking.
> **Note de relocalisation :** Ce fichier est dans `~/.claude/plans/` à cause du plan mode. Après approbation, le déplacer vers `docs/plans/2026-05-23-mvp-setup-data.md` dans le repo pour le versionner.

---

## Contexte

KStage est une PWA mobile-first qui permet aux fans de k-pop de suivre les events de leurs groupes (comebacks, music shows, lives, anniversaires) avec notifications push, fuseau horaire personnalisé, et calendrier filtré. MVP avec 4 groupes : aespa, ILLIT, Babymonster, (G)I-DLE.

**État actuel** : scaffolding `create-next-app` terminé (Next.js 16.2.6, React 19, TS strict, Tailwind v4, App Router, `src/`, alias `@/*`). Rien d'autre n'est branché. Ce plan couvre :

- Une **vue maître** des 9 étapes du MVP (étapes 3-9 décrites en haut niveau, chacune aura son propre plan détaillé au moment de l'exécution).
- Un **détail tâche-par-tâche** des étapes 1 (Setup) et 2 (Modèle de données + seed).

**Décisions verrouillées** (questions de cadrage répondues le 2026-05-23) :

- Nom : **KStage** (repo, package.json, manifest, domaine).
- UI : **shadcn/ui** sur Tailwind v4 (Radix UI dessous → a11y par défaut, copié dans le repo, customisable).
- Tests : **pragmatique** — Vitest sur logique métier (parsing, timezone, idempotence) + Playwright sur golden paths (auth, follow, calendrier). Pas de test UI trivial.
- Stack : Next.js 16 App Router, React 19, TS strict, Tailwind v4, shadcn/ui, Supabase (Postgres + Auth + Storage + RLS), Vercel, Serwist (PWA), Web Push API.

---

## Vue maître — 9 étapes du MVP

Chaque étape produit quelque chose de testable. **Une étape = une branche `feat/...` = un PR vers `main` même en solo** (force la relecture, comme indiqué CLAUDE.md B.7).

| #   | Étape                          | Livrable                                                                                                                                                                                                                          | Skill clé                                                           |
| --- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Setup projet**               | Repo GitHub branché, Supabase + Vercel hookés, tooling (Prettier, husky, lint-staged), shadcn/ui init, Vitest + Playwright config, CI GH Actions, PWA scaffold (manifest + icons). Déployé sur Vercel ("Hello KStage").           | `superpowers:executing-plans`                                       |
| 2   | **Modèle de données + seed**   | Schéma SQL (8 tables core), RLS activé, types TS générés, clients Supabase server/browser, seed 4 groupes + ~20 events fictifs, page `/test` affichant les events depuis DB.                                                      | `claude.ai Supabase` MCP                                            |
| 3   | **Frontend basique**           | Pages `/`, `/groups/[slug]`, vue calendrier mensuel, liste filtrable (groupe + type), design system shadcn appliqué, dark mode, responsive mobile-first, a11y (focus visible, ARIA, contrast WCAG AA).                            | `frontend-design`                                                   |
| 4   | **Auth + Follow groupes**      | Supabase Auth (email/password + OAuth Google), middleware SSR, table `UserFollow`, UI follow/unfollow, vue `/me/upcoming`, sélecteur timezone (Intl.supportedValuesOf).                                                           | `superpowers:test-driven-development` (auth flows)                  |
| 5   | **Pipeline scraping YouTube**  | API route `/api/cron/youtube` protégée par `CRON_SECRET`, Vercel Cron quotidien, table `Source` + `scrape_log`, idempotence sur `source_url`, fallback manuel via admin.                                                          | `superpowers:systematic-debugging` (erreurs scraping)               |
| 6   | **Notifications push**         | Service worker via Serwist, abonnement Web Push côté client, table `PushSubscription`, cron qui scanne events à venir + envoie via `web-push` lib, préférences user (lead time, types). **Test iOS install + notif obligatoire.** | `verify` (test réel iOS + Android)                                  |
| 7   | **Sources additionnelles**     | Modules isolés `lib/scrapers/{dbkpop,musicshows,weverse}.ts`, chacun avec son test de parsing sur fixture HTML. Cron unifié.                                                                                                      | `superpowers:dispatching-parallel-agents` (3 scrapers indépendants) |
| 8   | **Suggestions communautaires** | Form `/suggest`, table `EventSuggestion`, dashboard admin `/admin/suggestions` (auth role-based), notif email au contributeur via Supabase Edge Functions quand validé.                                                           | `code-review` (admin = surface d'attaque)                           |
| 9   | **Polish + lancement**         | SEO (sitemap, OG images dynamiques via `next/og`), landing page marketing, Plausible analytics, audit a11y (axe-core en CI), Lighthouse > 90 sur les 4 axes, soft launch Reddit/Twitter.                                          | `security-review` avant lancement                                   |

**Risques transverses** (à garder en tête pendant toute la durée) :

- **Sur-modélisation DB** : étendre les tables uniquement quand un besoin concret apparaît.
- **Burnout d'enthousiasme** : déployer sur Vercel dès étape 1 (visible = motivant), commits petits et fréquents.
- **iOS PWA** : tester l'install iPhone dès étape 6 sur device réel.
- **RLS oublié** : règle absolue — chaque nouvelle table avec données users → RLS activé + policies écrites dans la même migration.

---

## Étape 1 — Setup projet (détail)

### Vue de fichiers

```
Créer :
  .prettierrc                      → config Prettier
  .prettierignore                  → exclure node_modules, .next, public
  .husky/pre-commit                → hook lint-staged
  vitest.config.ts                 → config Vitest + jsdom
  vitest.setup.ts                  → @testing-library/jest-dom
  playwright.config.ts             → config Playwright
  tests/e2e/smoke.spec.ts          → E2E smoke test
  .github/workflows/ci.yml         → CI lint + typecheck + test + build
  src/lib/utils.ts                 → cn() helper (shadcn requirement)
  components.json                  → config shadcn/ui
  src/components/ui/.gitkeep       → dossier shadcn components
  public/manifest.webmanifest      → PWA manifest
  public/icons/icon-{192,512}.png  → icônes PWA (placeholder)
Modifier :
  package.json                     → scripts test, format, typecheck
  tsconfig.json                    → ajouter "types": ["vitest/globals"]
  eslint.config.mjs                → règles strictes + plugin-jsx-a11y
  src/app/layout.tsx               → lang="en", metadata, theme-color, manifest link
  src/app/page.tsx                 → "Hello KStage" minimaliste
  src/app/globals.css              → tokens shadcn (CSS variables)
  next.config.ts                   → headers sécurité de base
```

### Task 1.1 — GitHub remote + premier push

**Files :** aucun fichier modifié (config remote git).

- [ ] **Step 1 :** Créer le repo sur GitHub via UI (`kstage`, **privé** au début, pas de README/gitignore/license — déjà gérés localement).
- [ ] **Step 2 :** Brancher le remote et pousser.

```powershell
git remote add origin https://github.com/RudyG93/kstage.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3 :** Vérifier en ouvrant `https://github.com/RudyG93/kstage` — commit initial visible.
- [ ] **Step 4 :** Activer Dependabot + Secret Scanning dans `Settings → Security`.

### Task 1.2 — Projet Supabase + secrets

**Files :** `.env.local` (créé localement, **PAS commité**).

- [ ] **Step 1 :** Via MCP Supabase, lister les orgs : `mcp__claude_ai_Supabase__list_organizations`.
- [ ] **Step 2 :** Créer le projet via `mcp__claude_ai_Supabase__create_project` :
  - name: `kstage`
  - region: `eu-west-3` (Paris, latence FR)
  - confirm_cost_id : récupéré via `get_cost` + `confirm_cost`
- [ ] **Step 3 :** Récupérer URL + anon key : `get_project_url` + `get_publishable_keys`.
- [ ] **Step 4 :** Copier `.env.example` → `.env.local` et remplir :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # dashboard Supabase → API
```

- [ ] **Step 5 :** Vérifier que `.env.local` est git-ignored : `git status` ne doit pas le lister.

### Task 1.3 — Projet Vercel + secrets

**Files :** aucun (config Vercel via dashboard).

- [ ] **Step 1 :** Sur Vercel, "Add New → Project" → import du repo GitHub `kstage`. Framework auto-détecté (Next.js).
- [ ] **Step 2 :** Ne pas déployer encore : ajouter les variables d'environnement (Settings → Environment Variables) :
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (sensitive)
  - `CRON_SECRET` → générer via `openssl rand -hex 32` ou PowerShell `[Convert]::ToBase64String((1..32 | %{ Get-Random -Maximum 256 }))`
- [ ] **Step 3 :** Trigger redeploy depuis Vercel. Vérifier que le déploiement passe et que la page `/` affiche le scaffolding par défaut.
- [ ] **Step 4 :** Noter l'URL preview (sera utile pour les tests PWA mobile).

### Task 1.4 — Tooling dev (Prettier, husky, lint-staged, ESLint strict)

**Files :** voir liste ci-dessus.

- [ ] **Step 1 :** Installer les dépendances :

```powershell
npm install -D prettier prettier-plugin-tailwindcss eslint-plugin-jsx-a11y husky lint-staged
npx husky init
```

- [ ] **Step 2 :** `.prettierrc` :

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [ ] **Step 3 :** `.prettierignore` :

```
node_modules
.next
public
*.log
```

- [ ] **Step 4 :** Étendre `eslint.config.mjs` :

```js
import { FlatCompat } from '@eslint/eslintrc'
import jsxA11y from 'eslint-plugin-jsx-a11y'

const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  jsxA11y.flatConfigs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'react/jsx-key': 'error',
    },
  },
]
```

- [ ] **Step 5 :** `package.json` — ajouter scripts et `lint-staged` :

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json,css,md}": "prettier --write",
    "*.{ts,tsx}": "eslint --fix"
  }
}
```

- [ ] **Step 6 :** `.husky/pre-commit` :

```bash
npx lint-staged
```

- [ ] **Step 7 :** Vérifier : `npm run format`, `npm run lint`, `npm run typecheck` passent tous. Faire un commit test pour valider le hook.

### Task 1.5 — shadcn/ui init + tokens de base

**Files :** `components.json`, `src/lib/utils.ts`, `src/app/globals.css` (modifié).

- [ ] **Step 1 :** Init shadcn :

```powershell
npx shadcn@latest init
```

Réponses :

- Style : `New York` (plus moderne, espacements généreux)
- Base color : `slate`
- CSS variables : `yes`
- Tailwind config : auto-detect v4
- Path aliases : déjà configurés (`@/*`)

- [ ] **Step 2 :** Vérifier `src/lib/utils.ts` :

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3 :** Installer quelques primitives pour valider :

```powershell
npx shadcn@latest add button card dialog dropdown-menu
```

- [ ] **Step 4 :** Remplacer `src/app/page.tsx` par un "Hello KStage" minimal avec un `<Button>` :

```tsx
import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">KStage</h1>
        <p className="text-muted-foreground">Your k-pop calendar — coming soon.</p>
        <Button>Notify me</Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 5 :** `npm run dev` → vérifier que la page rend, que le bouton est focusable au clavier (Tab), focus ring visible.
- [ ] **Step 6 :** Commit `feat(ui): init shadcn/ui with base components`.

### Task 1.6 — Vitest + Playwright config

**Files :** `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `tests/e2e/smoke.spec.ts`.

- [ ] **Step 1 :** Installer :

```powershell
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2 :** `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

- [ ] **Step 3 :** `vitest.setup.ts` :

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 4 :** `tsconfig.json` — ajouter `"types": ["vitest/globals", "@testing-library/jest-dom"]` dans `compilerOptions`.

- [ ] **Step 5 :** `playwright.config.ts` :

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['iPhone 14'] },
  ],
})
```

- [ ] **Step 6 :** `tests/e2e/smoke.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test('home page renders', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'KStage' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Notify me' })).toBeVisible()
})
```

- [ ] **Step 7 :** Vérifier : `npm run test` (rien à exécuter pour l'instant, exit 0) + `npm run test:e2e` (smoke passe).
- [ ] **Step 8 :** Ajouter `test-results/`, `playwright-report/` au `.gitignore`. Commit.

### Task 1.7 — CI GitHub Actions

**Files :** `.github/workflows/ci.yml`.

- [ ] **Step 1 :** Créer le workflow :

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run format:check
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
```

- [ ] **Step 2 :** Pousser, ouvrir un PR vide depuis une branche `chore/ci` pour valider que le workflow passe.
- [ ] **Step 3 :** Configurer `Settings → Branches → main` → require status checks (cocher `check`).

### Task 1.8 — PWA scaffold (manifest + icons + viewport)

**Files :** `public/manifest.webmanifest`, `public/icons/icon-{192,512}.png`, `src/app/layout.tsx` (modifié).

- [ ] **Step 1 :** `public/manifest.webmanifest` :

```json
{
  "name": "KStage",
  "short_name": "KStage",
  "description": "Your k-pop calendar — events, comebacks, and lives.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 2 :** Générer placeholders d'icônes (192 et 512px PNG) — texte "KS" sur fond `#0a0a0a`. Outil : tout générateur (real favicon generator, ou Canva/Figma). Mettre dans `public/icons/`.

- [ ] **Step 3 :** Modifier `src/app/layout.tsx` :

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'KStage', template: '%s · KStage' },
  description: 'Your k-pop calendar — events, comebacks, and lives.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'KStage', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0a',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4 :** Lancer `npm run build && npm run start`, ouvrir DevTools → Application → Manifest. Vérifier que le manifest est valide (pas d'erreur).
- [ ] **Step 5 :** Tester sur mobile via l'URL Vercel : Safari iOS → "Add to Home Screen" → l'icône doit apparaître. (Le service worker arrivera étape 6 ; pour l'instant, manifest seul suffit.)
- [ ] **Step 6 :** Commit `feat(pwa): add manifest, icons, and viewport metadata`.

### Vérification d'étape 1

- [ ] CI verte sur `main`.
- [ ] Vercel deploy ✅ accessible à l'URL preview.
- [ ] `npm run lint && npm run typecheck && npm run test && npm run test:e2e` passent localement.
- [ ] `git log --oneline` montre une série de petits commits atomiques.
- [ ] Squash merge de la branche `feat/setup` vers `main` via PR.

---

## Étape 2 — Modèle de données + seed (détail)

### Vue de fichiers

```
Créer :
  supabase/migrations/0001_init.sql       → schéma + indexes + RLS
  supabase/seed.sql                       → 4 groupes + ~20 events fictifs
  src/types/database.ts                   → généré via supabase gen types
  src/lib/supabase/server.ts              → client server (Server Components)
  src/lib/supabase/browser.ts             → client browser (Client Components)
  src/lib/supabase/middleware.ts          → helper rafraîchissement session
  middleware.ts                           → middleware racine (Next.js)
  src/lib/events/queries.ts               → queries typées (getUpcomingEvents, etc.)
  src/app/test/page.tsx                   → page test temporaire (à supprimer étape 3)
```

### Task 2.1 — Schéma SQL initial

**Files :** `supabase/migrations/0001_init.sql`.

- [ ] **Step 1 :** Créer le dossier `supabase/migrations/` et le fichier `0001_init.sql` :

```sql
-- ============================================================
-- KStage — schéma initial
-- Principes :
--   - Tables publiques (groups, members, events, sources)
--     en lecture libre, écriture admin only.
--   - Tables user (user_follows, user_notification_settings,
--     event_suggestions, push_subscriptions) en RLS strict
--     (user n'accède qu'à ses propres lignes).
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type event_type as enum (
  'comeback', 'music_show', 'live', 'anniversary', 'concert', 'other'
);
create type event_status as enum ('confirmed', 'tentative', 'cancelled');
create type suggestion_status as enum ('pending', 'approved', 'rejected');

-- Groups
create table groups (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  agency text,
  fandom_name text,
  debut_date date,
  color_hex text,
  image_url text,
  created_at timestamptz not null default now()
);

-- Members
create table members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  stage_name text not null,
  real_name text,
  birthday date,
  position text,
  created_at timestamptz not null default now()
);
create index on members(group_id);

-- Sources (pour scraping log)
create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  type text not null, -- 'youtube_api' | 'dbkpop' | 'manual' | ...
  last_scraped_at timestamptz,
  created_at timestamptz not null default now()
);

-- Events
create table events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  type event_type not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz,
  status event_status not null default 'confirmed',
  source_id uuid references sources(id),
  source_url text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Idempotence : empêche le scraping de créer des doublons
  unique (group_id, type, start_at, source_url)
);
create index on events(start_at);
create index on events(group_id, start_at);
create index on events(type, start_at);

-- User follows
create table user_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);
create index on user_follows(group_id);

-- User notification settings
create table user_notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type event_type not null,
  lead_time_minutes int not null default 1440, -- J-1 par défaut
  channel text not null default 'push',
  enabled boolean not null default true,
  unique (user_id, event_type, channel)
);
create index on user_notification_settings(user_id);

-- Event suggestions (pour la modération communautaire — étape 8)
create table event_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references groups(id),
  type event_type not null,
  title text not null,
  description text,
  start_at timestamptz not null,
  source_url text,
  status suggestion_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on event_suggestions(status, created_at desc);

-- Push subscriptions (pour Web Push — étape 6)
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
```

- [ ] **Step 2 :** Appliquer via MCP : `mcp__claude_ai_Supabase__apply_migration` avec `name: '0001_init'` et le SQL ci-dessus.
- [ ] **Step 3 :** Vérifier via `mcp__claude_ai_Supabase__list_tables` que les 8 tables existent.

### Task 2.2 — RLS policies

**Files :** même migration (ou `0002_rls.sql` si préféré).

- [ ] **Step 1 :** Créer `supabase/migrations/0002_rls.sql` :

```sql
-- ============================================================
-- Row Level Security
-- ============================================================

-- Tables publiques en lecture (anyone), écriture service_role only
alter table groups enable row level security;
alter table members enable row level security;
alter table events enable row level security;
alter table sources enable row level security;

create policy "groups readable by all"
  on groups for select using (true);
create policy "members readable by all"
  on members for select using (true);
create policy "events readable by all"
  on events for select using (true);
create policy "sources readable by all"
  on sources for select using (true);

-- (service_role bypasse RLS automatiquement → utilisé par les cron jobs)

-- Tables user : accès strict à ses propres lignes
alter table user_follows enable row level security;
alter table user_notification_settings enable row level security;
alter table event_suggestions enable row level security;
alter table push_subscriptions enable row level security;

create policy "user_follows: own rows"
  on user_follows for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_notification_settings: own rows"
  on user_notification_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Suggestions : user voit + crée les siennes, admins voient tout (étape 8 ajoutera role check)
create policy "event_suggestions: own rows insert/select"
  on event_suggestions for select
  using (auth.uid() = user_id);
create policy "event_suggestions: own rows insert"
  on event_suggestions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions: own rows"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2 :** Appliquer via `apply_migration` (`name: '0002_rls'`).
- [ ] **Step 3 :** Vérifier via `mcp__claude_ai_Supabase__get_advisors` (lint) — pas de warning RLS.

### Task 2.3 — Génération types TS

**Files :** `src/types/database.ts`.

- [ ] **Step 1 :** Via MCP : `mcp__claude_ai_Supabase__generate_typescript_types` → copier le résultat dans `src/types/database.ts`.
- [ ] **Step 2 :** Ajouter une ligne de re-export en haut :

```ts
// Auto-généré via supabase gen types — ne pas éditer manuellement.
// Régénérer : `npm run types:db` (script étape 5 quand on stabilisera).
```

- [ ] **Step 3 :** Vérifier `npm run typecheck` passe.

### Task 2.4 — Clients Supabase (server + browser) + middleware

**Files :** `src/lib/supabase/{server,browser,middleware}.ts`, `middleware.ts` (racine).

- [ ] **Step 1 :** Installer :

```powershell
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2 :** `src/lib/supabase/browser.ts` :

```ts
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 3 :** `src/lib/supabase/server.ts` :

```ts
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component context — ignore (refresh côté middleware)
          }
        },
      },
    },
  )
}
```

- [ ] **Step 4 :** `src/lib/supabase/middleware.ts` (refresh session sur chaque navigation) :

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  await supabase.auth.getUser()
  return response
}
```

- [ ] **Step 5 :** `middleware.ts` racine :

```ts
import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 6 :** Vérifier `npm run typecheck && npm run build` — pas d'erreur.

### Task 2.5 — Seed des 4 groupes

**Files :** `supabase/seed.sql` (référence) — appliqué via `execute_sql`.

- [ ] **Step 1 :** Préparer le SQL :

```sql
insert into groups (slug, name, agency, fandom_name, debut_date, color_hex) values
  ('aespa', 'aespa', 'SM Entertainment', 'MY', '2020-11-17', '#000000'),
  ('illit', 'ILLIT', 'BELIFT LAB', 'GLLIT', '2024-03-25', '#F5C6D6'),
  ('babymonster', 'BABYMONSTER', 'YG Entertainment', 'MONSTIEZ', '2023-11-27', '#F2A900'),
  ('gidle', '(G)I-DLE', 'CUBE Entertainment', 'NEVERLAND', '2018-05-02', '#D4145A')
on conflict (slug) do nothing;
```

- [ ] **Step 2 :** Appliquer via `mcp__claude_ai_Supabase__execute_sql`.
- [ ] **Step 3 :** Vérifier via `execute_sql` : `select slug, name from groups order by debut_date;` → 4 lignes.

### Task 2.6 — Seed events fictifs

**Files :** SQL ad-hoc (pas commité — seul le schéma est versionné, les fixtures dev sont OK en seed séparé).

- [ ] **Step 1 :** Préparer ~20 events couvrant les 4 types + différentes dates (passé, présent, futur). Exemple condensé :

```sql
with g as (select id, slug from groups)
insert into events (group_id, type, title, start_at, status, source_url) values
  ((select id from g where slug='aespa'),       'comeback',    'aespa new album', '2026-06-15 09:00+00', 'confirmed', 'https://example.com/aespa-06-15'),
  ((select id from g where slug='aespa'),       'music_show',  'M Countdown',     '2026-05-29 11:00+00', 'confirmed', null),
  ((select id from g where slug='illit',)       'live',        'Weverse Live',    '2026-05-25 12:00+00', 'confirmed', null),
  ((select id from g where slug='babymonster'), 'anniversary', '2nd debut anniversary', '2025-11-27 00:00+00', 'confirmed', null),
  ((select id from g where slug='gidle'),       'comeback',    '(G)I-DLE 9th mini', '2026-07-01 09:00+00', 'tentative', null)
  -- ... compléter à ~20
on conflict do nothing;
```

- [ ] **Step 2 :** Appliquer via `execute_sql`.
- [ ] **Step 3 :** Vérifier : `select count(*), type from events group by type;`

### Task 2.7 — Page test `/test` affichant les events

**Files :** `src/lib/events/queries.ts`, `src/app/test/page.tsx`.

- [ ] **Step 1 :** Test unitaire d'abord (TDD pragmatique sur logique de query). Créer `src/lib/events/queries.test.ts` :

```ts
import { describe, it, expect } from 'vitest'
import { formatEventDate } from './queries'

describe('formatEventDate', () => {
  it('formats UTC date in given timezone', () => {
    const result = formatEventDate('2026-06-15T09:00:00Z', 'Asia/Seoul')
    expect(result).toMatch(/Jun.*15.*2026/)
  })
})
```

- [ ] **Step 2 :** `npm run test` → FAIL (formatEventDate undefined).
- [ ] **Step 3 :** Implémenter `src/lib/events/queries.ts` :

```ts
import { createClient } from '@/lib/supabase/server'

export async function getUpcomingEvents(limit = 50) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('id, title, type, start_at, status, groups(slug, name, color_hex)')
    .gte('start_at', new Date().toISOString())
    .order('start_at', { ascending: true })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export function formatEventDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(iso))
}
```

- [ ] **Step 4 :** `npm run test` → PASS.
- [ ] **Step 5 :** `src/app/test/page.tsx` :

```tsx
import { getUpcomingEvents, formatEventDate } from '@/lib/events/queries'

export default async function TestPage() {
  const events = await getUpcomingEvents()

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-2xl font-bold">Upcoming events (debug)</h1>
      <ul className="space-y-2" aria-label="Upcoming events">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg border p-3">
            <div className="text-muted-foreground text-sm">
              {formatEventDate(e.start_at, 'Asia/Seoul')} KST · {e.type}
            </div>
            <div className="font-medium">
              {e.groups?.name} — {e.title}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 6 :** `npm run dev`, ouvrir `http://localhost:3000/test` → liste d'events s'affiche.
- [ ] **Step 7 :** Test E2E `tests/e2e/test-page.spec.ts` :

```ts
import { test, expect } from '@playwright/test'

test('/test displays events from DB', async ({ page }) => {
  await page.goto('/test')
  await expect(page.getByRole('heading', { name: /upcoming events/i })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Upcoming events' })).toBeVisible()
})
```

- [ ] **Step 8 :** Commit `feat(data): schema, seed, server client, /test page`.

### Vérification d'étape 2

- [ ] `mcp__claude_ai_Supabase__list_tables` montre les 8 tables.
- [ ] `mcp__claude_ai_Supabase__get_advisors` ne signale aucun warning RLS.
- [ ] `npm run typecheck` passe (types DB générés sans erreur).
- [ ] `/test` affiche les events sur l'URL Vercel preview.
- [ ] PR `feat/data-model` mergé sur `main`.

---

## Notes transversales (à garder en tête sur les 9 étapes)

### Accessibilité (a11y)

- **Composants shadcn** = a11y de base (Radix UI dessous), mais **vérifier** focus visible + ARIA labels sur composants custom.
- **Tests axe-core** : ajouter `vitest-axe` + assertion sur les pages critiques (étape 3+).
- **Contraste WCAG AA** : valider les couleurs custom (les `color_hex` par groupe ne doivent pas servir de background sous du texte sans vérif).
- **Navigation clavier complète** : tab order, ESC pour fermer modals, ARIA live regions pour les notifs in-app.
- **Préférences user** : respecter `prefers-reduced-motion` + `prefers-color-scheme`.

### Conventions modernes (Next.js 16 / React 19)

- **Server Components par défaut** — `'use client'` uniquement pour interactivité.
- **Server Actions** pour mutations (form actions), pas d'API route quand ça suffit.
- **Streaming + Suspense** pour les listes lentes (events, etc.).
- **`next/image` + `next/font`** systématiquement.
- **Auth via cookies SSR** (déjà setup étape 2.4), pas de `localStorage`.
- **TypeScript strict** déjà activé — pas de `any` (sauf cas marginal + commentaire).

### Sécurité

- **RLS sur 100% des tables** avec données users (vérif via `get_advisors`).
- **`CRON_SECRET`** requis sur toutes les API routes scraping/notif.
- **Service role key** uniquement côté serveur (jamais `NEXT_PUBLIC_*`).
- **Rate limiting** sur les routes publiques POST (suggestions, push subscribe) — étape 8.
- **Pas de scraping agressif** : 1-2× par jour max, respect `robots.txt`.

### Performance

- **ISR / cache agressif** sur les pages publiques d'events (`revalidate: 3600`).
- **Pagination** dès liste > 50 items.
- **Edge runtime** sur les routes simples (auth check, redirects) — pas sur les routes Supabase.

---

## Verification end-to-end (après étapes 1-2)

```powershell
# Sanity check local
npm install
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e

# DB sanity check (via MCP)
# - list_tables : 8 tables
# - execute_sql : "select count(*) from groups;" → 4
# - execute_sql : "select count(*) from events;" → ~20
# - get_advisors : aucun warning RLS critical

# Live preview Vercel
# - https://kstage.vercel.app/ → "KStage" + bouton "Notify me"
# - https://kstage.vercel.app/test → liste d'events depuis DB
# - DevTools mobile : manifest valide, viewport correct, lang="en"
# - Lighthouse PWA : "Installable" ✅ (sans SW pour l'instant — SW vient étape 6)
```

---

## Self-Review

- **Couverture spec** : les étapes 1-2 couvrent le scaffold + DB de la roadmap CLAUDE.md B.6 §1-2. Étapes 3-9 sont listées dans la vue maître mais détaillées plus tard (par design, validé avec l'utilisateur).
- **Pas de placeholders** : chaque task contient le code/SQL exact ou la commande exacte. Pas de "TBD", pas de "add appropriate error handling".
- **Cohérence des types** : `Database` type re-utilisé entre `server.ts`, `browser.ts`, `middleware.ts`. `formatEventDate` signature stable. Colonnes DB (`group_id`, `start_at`, `type`, etc.) cohérentes entre migration, seed et queries.
- **Skills mappées par étape** : voir colonne "Skill clé" du tableau maître.
- **Décisions traçables** : nom (KStage), UI (shadcn), tests (pragmatique) verrouillés dans Contexte, source = AskUserQuestion du 2026-05-23.

---

## Handoff d'exécution

**Plan complet.** Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — Dispatch d'un subagent frais par task, review entre tasks, itération rapide. Skill : `superpowers:subagent-driven-development`.
2. **Inline Execution** — Exécution des tasks dans cette session avec checkpoints. Skill : `superpowers:executing-plans`.

À choisir au moment de l'exécution (après approbation de ce plan).
