# KStage — Audit sécurité (Phase 6)

> **Rafraîchi le 2026-07-18 (Lot D)** — le document du 2026-06-12 listait comme ouverts 4 items corrigés depuis (getOpenReports, rate-limit atomique, CSP enforce, handle_new_user) : ils sont marqués ✅ ci-dessous avec leur date de fix. À relire avant chaque ouverture publique.
> Niveau : MVP indé, base utilisateurs réduite. Pas un audit de pénétration formel.

## OWASP Top 10 — état

1. **Broken Access Control** — 🟡 RLS sur 100 % des tables à données users (vérifié live : 19/19 tables, aucune policy d'écriture permissive). Politiques `insert/update/delete own` ; lectures publiques limitées aux données publiques. Modération admin via **service role** côté serveur (jamais exposé client), gardée par `isAdmin` (allowlist e-mail). Auto-vote bloqué au niveau DB (PK `(user_id, comment_id)`). ✅ **Corrigé 2026-06-15** : `getOpenReports` est gardée par `requireAdminUser()` ; l'audit des 11 fichiers `'use server'` n'a trouvé aucune autre exception. **Depuis 2026-07-18 (Lot D)** : gate CENTRAL `src/app/admin/layout.tsx` (`requireAdminPage()`) en plus des gardes par page — une future page admin ne peut plus oublier la sienne.
2. **Cryptographic Failures** — ✅ Mots de passe gérés par Supabase Auth (bcrypt). Aucune donnée sensible stockée en clair.
3. **Injection** — ✅ Aucune requête SQL brute applicative (PostgREST paramétré ; le seul SQL est dans les migrations/RPC contrôlés). Contenu user rendu via React (échappement par défaut) ; **aucun `dangerouslySetInnerHTML`**. Inputs validés/normalisés côté serveur (`validation.ts`).
4. **Insecure Design** — ✅ **Corrigé 2026-07-04 (migration 0038)** : RPC atomique `consume_rate_limit` (SECURITY DEFINER + advisory lock, table deny-all) sur les 5 writes publics — commentaires 5/60s, suggestions 10/24h, feedback 2/24h, push subscribe 20/24h, analytics 120/h. Votes/ratings/likes/follows restent sans limite applicative (session requise + RLS — accepté). Auth rate-limitée nativement par Supabase ; anti-énumération conservée.
5. **Security Misconfiguration** — ✅ `.env.local` git-ignored ; secrets uniquement sur Vercel. Headers de sécurité dans `next.config.ts` : HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, **CSP en ENFORCE depuis le 2026-07-04** (report-only en dev ; `unsafe-inline` script/style = tradeoff documenté dans next.config.ts, nonces gated pré-lancement). HTTPS forcé par Vercel.
6. **Vulnerable Components** — ✅ **Depuis 2026-07-18 (Lot D)** : Dependabot (npm hebdo groupé + github-actions) + step CI `npm audit --omit=dev --audit-level=high` (report-only, à passer bloquant après 2 semaines calmes). Lockfile committé.
7. **Identification & Auth Failures** — ✅ OTP e-mail (signup/reset) expirant 15 min, géré par Supabase. Sessions JWT signées, refresh via middleware. Rate-limit Supabase.
8. **Software & Data Integrity** — ✅ Lockfile committé. Données scrapées validées/normalisées avant insertion (idempotence via clés uniques).
9. **Logging & Monitoring** — ✅ Câblé le 2026-06-12 (P0.3) : chaque run de scraping écrit dans `scrape_log` (statut ok/partial/error + counts en jsonb), les routes renvoient 500 quand le run est inexploitable (visible dans le dashboard Vercel Crons), et `last_scraped_at` n'est rafraîchi qu'en cas de récolte réelle (cf. `SCRAPING.md §6`). Vercel Analytics (cookieless) OK. Pas de Sentry (acceptable à ce stade).
10. **SSRF** — 🟡 Les champs URL des suggestions (source/image) sont validés (`http(s)://`) mais pas encore fetchés côté serveur → pas de surface SSRF active. À durcir (whitelist d'hôtes) si on fetche ces URLs un jour.

## Supabase — état

- ✅ RLS activée sur **toutes** les tables ; nouvelles tables (`artist_suggestions`, `comment_edit_history`, `comment_report`) avec policies dès la migration.
- ✅ `scrape_log` : deny explicite (policy `using (false)`), service role pour les écritures.
- ✅ `service_role` key **server-only** (jamais `NEXT_PUBLIC_*`).
- ✅ **Corrigé 2026-06-16 (migration 0034)** : `revoke execute … from public, anon, authenticated` sur `handle_new_user` — advisor éteint, vérifié non exécutable. 0034 a aussi optimisé les 21 policies RLS (`(select auth.uid())`).
- ✅ Baseline advisors ACCEPTÉE (2026-07-04, re-vérifiée) : 3 fonctions SECURITY DEFINER intentionnelles (`group_follow_counts`, `profile_stats`, `consume_rate_limit` — compteurs publics, aucune row privée) + 2 RLS deny-all (INFO). `citext` déplacé vers `extensions` (migration 0052). Listing des buckets fermé (migration 0035). **Leaked password protection ACTIVÉE** (Rudy, 2026-06-16).
- ✅ **Signature JWT asymétrique ECC P-256** (migrée ~2026-05) + **`getClaims()` local sur le chemin lecture** (Lot 1bis 2026-07-18) — plus d'aller-retour Auth par requête ; les écritures gardent `getUser()`.
- 🔜 **Migration clés API officielles** (`sb_publishable_…`/`sb_secret_…`, plan 2026-07-18 Lot C) : remplacer anon/service_role legacy, puis les désactiver, puis révoquer le secret HS256 legacy — runbook dans le plan.

## CSP report-only — durcissement futur

**Enforce depuis le 2026-07-04** (`unsafe-eval` retiré en prod). Reste `'unsafe-inline'` script/style : les nonces forceraient le rendu 100 % dynamique (tue les shells statiques visés par cacheComponents) et `style-src` nonce est incompatible avec les attributs `style` React — tradeoff documenté, à revisiter au lancement public (piste : SRI expérimental une fois les shells statiques en place).

## Tests adversariaux — à mener avant ouverture publique

XSS dans commentaires/username/champs Contribute ; accès direct `/admin/*` sans rôle ; modification `tier`/`role` côté client (bloqué RLS) ; spam commentaires/votes ; vote sur son propre commentaire (bloqué) ; CSRF sur actions POST sensibles (Server Actions Next protègent via origine).
