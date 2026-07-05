# CLAUDE.md — KStage

> Règles de comportement **spécifiques à KStage**. Les 4 principes universels (Think Before Coding, Simplicity First, Surgical Changes, Goal-Driven Execution) sont fournis par le `CLAUDE.md` parent du dossier au-dessus — **non répétés ici** pour éviter le doublon.
>
> - **Contexte produit & technique** (vision, scope, DB, sources, roadmap) → `docs/PROJECT.md`
> - **Scraping (architecture, pièges traversés, diagnostics)** → `docs/SCRAPING.md`
> - **Spécifique Next.js 16** (breaking changes) → `AGENTS.md`
> - **Plans d'étape détaillés** → `docs/plans/`

---

## Langue & communication

- Conversation en **français**, **tutoiement**.
- Réponses **concises**, paragraphes courts. Pas de filler, pas de récap de ce qui vient d'être fait.
- **Contredire quand l'user se trompe** plutôt que valider par défaut. La profondeur est bienvenue, le volume non.
- **Code et identifiants en anglais** (standard du fandom k-pop international). Commentaires de code en EN ou FR mais cohérents.

---

## Méthodologie de recherche (à appliquer à chaque demande)

Pour **chaque** tâche, avant d'implémenter ou de proposer une solution :

1. **Analyser profondément** — ne pas se contenter du premier WebSearch superficiel. Croiser les sources : oembed YouTube, Jina reader (`r.jina.ai`), fetch direct, API officielle quand dispo, MCP Supabase / Playwright pour vérifier l'état réel en prod.
2. **Prendre le temps** — pas d'optimisation prématurée vers une réponse rapide quand la réponse correcte demande de l'investigation.
3. **Utiliser plusieurs outils en concertation** — sous-agents (`Explore`, specialists `ecc:typescript-reviewer` / `ecc:a11y-architect` / `ecc:database-reviewer`) en parallèle quand les sujets sont indépendants ; chacun sa tâche bien cadrée dans son prompt.
4. **Poser des questions** dès qu'un doute ou un choix architectural se présente — `AskUserQuestion` avec options concrètes (Recommended marquée, descriptions explicitant les tradeoffs) plutôt qu'hypothèses cachées.
5. **Synthétiser** — restituer un résultat consolidé, pas un dump brut de chaque outil.
6. **Vérifier avant de claim** — MCP Supabase / Playwright / curl pour confirmer que ça marche en prod, pas juste « tests verts ».

Cf. mémoire `feedback-deep-research-methodology` (persistant cross-session). Pour les pièges scraping spécifiques déjà traversés, lire `docs/SCRAPING.md §3` AVANT de toucher au code.

---

## Pre-/clear ritual

Avant chaque `/clear` ou reset de contexte demandé par Rudy, exécuter en plan mode :

1. **Identifier les leçons** apprises au cours de la session (techniques + méthodologiques + erreurs commises).
2. **Capturer dans memory** chaque leçon comme un fichier `feedback_*.md` ou `reference_*.md` séparé (Why + How to apply pour les feedback ; étapes reproductibles pour les reference).
3. **Mettre à jour les markdowns** concernés selon pertinence : `CLAUDE.md` (règles), `docs/SCRAPING.md` (pièges scraper §3 + discovery §4), `docs/PROJECT.md` (état projet).
4. **Session log court** : `session_log_<date>_<topic>.md` listant PRs livrés / restants / état prod. Permet à la session suivante de reprendre vite.
5. **Update `MEMORY.md` index** : ligne par nouvelle memory.
6. **Confirmer à Rudy** ce qui a été capturé avant qu'il fasse le `/clear`.

Validation : voir `feedback-pre-clear-ritual`, `feedback-real-data-over-fixtures`, `feedback-pr-superseding-awareness`, `reference-yt-channel-discovery` pour les leçons capturées au 2026-05-28.

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

## Journal de bord (docs vivantes)

Après **chaque merge sur `main`**, dans le même mouvement (pas « plus tard ») :

1. **`docs/JOURNAL.md`** — nouvelle entrée en tête : date, branche/commit, quoi, pourquoi, vérification, décisions prises. C'est l'historique daté du projet.
2. **`docs/BACKLOG.md`** — cocher/mettre à jour les items touchés (détail de ce qui a été fait + écarts assumés).
3. **`docs/PROJECT.md §9`** — rafraîchir l'état courant **seulement si** phase/chiffres/pages changent (l'historique ne s'y accumule plus, il va au JOURNAL).

Décisions produit cross-session → aussi dans la memory `project_decisions_ledger`. Pièges scraping → `docs/SCRAPING.md §3`.

---

## Discipline de scope

- **Rester strict sur le MVP.** Pousser back sur le scope creep.
- **Pas de sur-modélisation DB** (sub-units, agencies parentes, etc.) tant qu'aucun besoin concret n'apparaît.
- **Déployer tôt et souvent** sur Vercel — visible = motivant, et on attrape les surprises (surtout iOS PWA) au plus tôt.
