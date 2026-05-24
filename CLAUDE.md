# CLAUDE.md — KStage

> Règles de comportement **spécifiques à KStage**. Les 4 principes universels (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) sont fournis par le `CLAUDE.md` parent du dossier au-dessus — **non répétés ici** pour éviter le doublon.
>
> - **Contexte produit & technique** (vision, scope, DB, sources, roadmap) → `docs/PROJECT.md`
> - **Spécifique Next.js 16** (breaking changes) → `AGENTS.md`
> - **Plans d'étape détaillés** → `docs/plans/`

---

## Langue & communication

- Conversation en **français**, **tutoiement**.
- Réponses **concises**, paragraphes courts. Pas de filler, pas de récap de ce qui vient d'être fait.
- **Contredire quand l'user se trompe** plutôt que valider par défaut. La profondeur est bienvenue, le volume non.
- **Code et identifiants en anglais** (standard du fandom k-pop international). Commentaires de code en EN ou FR mais cohérents.

---

## Conventions Next.js 16 / React 19

- **Server Components par défaut** — `'use client'` uniquement pour l'interactivité.
- **Server Actions** pour les mutations (form actions) ; pas d'API route quand une action suffit.
- **`next/image` + `next/font`** systématiquement.
- **Auth via cookies SSR** (clients dans `src/lib/supabase/`), jamais `localStorage`.
- **TypeScript strict** — pas de `any` (sauf cas marginal explicitement commenté).
- API Next inconnue ou suspecte → lire `node_modules/next/dist/docs/` **avant** d'écrire (voir `AGENTS.md`).

---

## Sécurité

- **RLS sur 100 % des tables** à données users. Les policies sont écrites dans la **même migration** que la table — jamais une table user sans RLS, même temporairement.
- **Données externes = non fiables.** Tout HTML scrapé et toute réponse d'API tierce est validée/normalisée **avant** insertion en DB. Idempotence via clé `unique` (pas de doublons au re-scrape).
- **Secrets jamais commités** (`.env.local` git-ignored). La `service_role` key est **server-only** — jamais préfixée `NEXT_PUBLIC_*`.
- **`CRON_SECRET`** requis sur toutes les routes scraping/notif. **Rate-limit** sur les routes POST publiques (suggestions, push subscribe).
- Scraping : **respect de `robots.txt`**, 1-2× par jour maximum.

---

## Tests (pragmatique)

- **Vitest** sur la logique métier : parsing de scraping, timezone, idempotence.
- **Playwright** sur les golden paths : auth, follow, calendrier.
- **Pas** de test sur composant UI trivial. **Pas** de TDD imposé.

---

## Git

- **Une branche par feature** : `feat/auth`, `feat/scraping-youtube`, `fix/timezone-bug`…
- Commits **petits, atomiques**, messages clairs (FR ou EN, mais cohérent).
- **PR vers `main` même en solo** (force la relecture).

---

## Discipline de scope

- **Rester strict sur le MVP.** Pousser back sur le scope creep.
- **Pas de sur-modélisation DB** (sub-units, agencies parentes, etc.) tant qu'aucun besoin concret n'apparaît.
- **Déployer tôt et souvent** sur Vercel — visible = motivant, et on attrape les surprises (surtout iOS PWA) au plus tôt.
