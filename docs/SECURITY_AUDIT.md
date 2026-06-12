# KStage — Audit sécurité (Phase 6)

> État au moment de la finalisation MVP, **corrigé le 2026-06-12** après contre-vérification en prod (advisors live + SQL + lecture du code — cf. `AUDIT_PROJET_2026-06-12.md §3.3`) : plusieurs claims initiaux étaient faux, ils sont marqués ⚠️ ci-dessous. À relire avant chaque ouverture publique.
> Niveau : MVP indé, base utilisateurs réduite. Pas un audit de pénétration formel.

## OWASP Top 10 — état

1. **Broken Access Control** — 🟡 RLS sur 100 % des tables à données users (vérifié live : 19/19 tables, aucune policy d'écriture permissive). Politiques `insert/update/delete own` ; lectures publiques limitées aux données publiques. Modération admin via **service role** côté serveur (jamais exposé client), gardée par `isAdmin` (allowlist e-mail). Auto-vote bloqué au niveau DB (PK `(user_id, comment_id)`). ⚠️ **Exception trouvée le 2026-06-12** : `getOpenReports` (`src/lib/comments/moderation.ts`) est une Server Action exportée d'un module `'use server'` **sans** `requireAdminUser()` — elle lit la file de modération via service_role en contournant la RLS (chaque export d'un fichier `'use server'` est un endpoint HTTP public). **À corriger (BACKLOG P1)** + auditer tous les exports `'use server'`.
2. **Cryptographic Failures** — ✅ Mots de passe gérés par Supabase Auth (bcrypt). Aucune donnée sensible stockée en clair.
3. **Injection** — ✅ Aucune requête SQL brute applicative (PostgREST paramétré ; le seul SQL est dans les migrations/RPC contrôlés). Contenu user rendu via React (échappement par défaut) ; **aucun `dangerouslySetInnerHTML`**. Inputs validés/normalisés côté serveur (`validation.ts`).
4. **Insecure Design** — 🟡 Rate-limit applicatif **best-effort, non robuste** (corrigé 2026-06-12) : commentaires (5/min/user) et suggestions (cap quotidien) sont des comptages check-then-insert **non atomiques** (contournables en rafale concurrente) ; aucun rate-limit sur push subscribe, votes, ratings, likes, follows, avatar. Atténué : toutes ces mutations exigent une session, et l'auth (login/signup/reset) est rate-limitée nativement par Supabase. Blocklist anti-spam basique sur les commentaires. Anti-énumération sur l'auth (messages génériques). → Vrai limiteur (atomique) avant ouverture publique (BACKLOG P2).
5. **Security Misconfiguration** — ✅ `.env.local` git-ignored ; secrets uniquement sur Vercel. Headers de sécurité dans `next.config.ts` : HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, **CSP (report-only)**. HTTPS forcé par Vercel.
6. **Vulnerable Components** — 🟡 `npm audit` ponctuel. Lockfile committé. Pas de CI bloquante sur vulnérabilités (à ajouter).
7. **Identification & Auth Failures** — ✅ OTP e-mail (signup/reset) expirant 15 min, géré par Supabase. Sessions JWT signées, refresh via middleware. Rate-limit Supabase.
8. **Software & Data Integrity** — ✅ Lockfile committé. Données scrapées validées/normalisées avant insertion (idempotence via clés uniques).
9. **Logging & Monitoring** — ✅ Câblé le 2026-06-12 (P0.3) : chaque run de scraping écrit dans `scrape_log` (statut ok/partial/error + counts en jsonb), les routes renvoient 500 quand le run est inexploitable (visible dans le dashboard Vercel Crons), et `last_scraped_at` n'est rafraîchi qu'en cas de récolte réelle (cf. `SCRAPING.md §6`). Vercel Analytics (cookieless) OK. Pas de Sentry (acceptable à ce stade).
10. **SSRF** — 🟡 Les champs URL des suggestions (source/image) sont validés (`http(s)://`) mais pas encore fetchés côté serveur → pas de surface SSRF active. À durcir (whitelist d'hôtes) si on fetche ces URLs un jour.

## Supabase — état

- ✅ RLS activée sur **toutes** les tables ; nouvelles tables (`artist_suggestions`, `comment_edit_history`, `comment_report`) avec policies dès la migration.
- ✅ `scrape_log` : deny explicite (policy `using (false)`), service role pour les écritures.
- ✅ `service_role` key **server-only** (jamais `NEXT_PUBLIC_*`).
- 🔴 ⚠️ Corrigé 2026-06-12 : le revoke de `handle_new_user` (migration 0025) est **inefficace** — il révoque anon/authenticated mais pas le grant **PUBLIC** par défaut (`proacl` vérifié : `=X` présent), donc anon/authenticated l'héritent toujours et l'advisor fire encore. Exploitabilité faible (fonction trigger, échoue hors contexte). Fix : `revoke execute on function public.handle_new_user() from public;` dans une nouvelle migration (BACKLOG P1). Même traitement à évaluer pour `profile_stats`.
- 🟡 Advisors restants (re-vérifiés live le 2026-06-12, toujours ouverts) :
  - `group_follow_counts` SECURITY DEFINER exécutable — **intentionnel** (agrégat de follows cross-users, aucune donnée d'identité exposée).
  - Extension `citext` dans `public` — déplacement risqué (colonne `username`) → différé.
  - Buckets publics `avatars`/`banners` autorisent le listing — resserrer la policy SELECT storage → follow-up (risque de casser l'affichage à tester).
  - **Leaked password protection désactivé** → **à activer dans le dashboard Supabase** (Auth → Password security). _Action Rudy._

## CSP report-only — durcissement futur

La CSP est en `Content-Security-Policy-Report-Only` (ne bloque rien, log les violations en console). Après observation des rapports en prod, passer en `Content-Security-Policy` (enforce) en retirant `'unsafe-inline'`/`'unsafe-eval'` si possible (Next 16 + nonces).

## Tests adversariaux — à mener avant ouverture publique

XSS dans commentaires/username/champs Contribute ; accès direct `/admin/*` sans rôle ; modification `tier`/`role` côté client (bloqué RLS) ; spam commentaires/votes ; vote sur son propre commentaire (bloqué) ; CSRF sur actions POST sensibles (Server Actions Next protègent via origine).
