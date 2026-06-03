# KStage — Audit sécurité (Phase 6)

> État au moment de la finalisation MVP. À relire avant chaque ouverture publique.
> Niveau : MVP indé, base utilisateurs réduite. Pas un audit de pénétration formel.

## OWASP Top 10 — état

1. **Broken Access Control** — ✅ RLS sur 100 % des tables à données users (follows, comments, votes, ratings, likes, suggestions, profiles, push subscriptions, edit history, reports…). Politiques `insert/update/delete own` ; lectures publiques limitées aux données publiques. Modération admin via **service role** côté serveur (jamais exposé client), gardée par `isAdmin` (allowlist e-mail). Auto-vote bloqué au niveau DB (PK `(user_id, comment_id)`).
2. **Cryptographic Failures** — ✅ Mots de passe gérés par Supabase Auth (bcrypt). Aucune donnée sensible stockée en clair.
3. **Injection** — ✅ Aucune requête SQL brute applicative (PostgREST paramétré ; le seul SQL est dans les migrations/RPC contrôlés). Contenu user rendu via React (échappement par défaut) ; **aucun `dangerouslySetInnerHTML`**. Inputs validés/normalisés côté serveur (`validation.ts`).
4. **Insecure Design** — ✅ Rate-limit applicatif : commentaires (5/min/user), suggestions (cap quotidien combiné events+artists). Auth (login/signup/reset) rate-limitée nativement par Supabase. Blocklist anti-spam basique sur les commentaires. Anti-énumération sur l'auth (messages génériques).
5. **Security Misconfiguration** — ✅ `.env.local` git-ignored ; secrets uniquement sur Vercel. Headers de sécurité dans `next.config.ts` : HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, **CSP (report-only)**. HTTPS forcé par Vercel.
6. **Vulnerable Components** — 🟡 `npm audit` ponctuel. Lockfile committé. Pas de CI bloquante sur vulnérabilités (à ajouter).
7. **Identification & Auth Failures** — ✅ OTP e-mail (signup/reset) expirant 15 min, géré par Supabase. Sessions JWT signées, refresh via middleware. Rate-limit Supabase.
8. **Software & Data Integrity** — ✅ Lockfile committé. Données scrapées validées/normalisées avant insertion (idempotence via clés uniques).
9. **Logging & Monitoring** — 🟡 `scrape_log` pour les scrapers. Vercel Analytics (cookieless). Pas de Sentry (à ajouter pour les erreurs serveur).
10. **SSRF** — 🟡 Les champs URL des suggestions (source/image) sont validés (`http(s)://`) mais pas encore fetchés côté serveur → pas de surface SSRF active. À durcir (whitelist d'hôtes) si on fetche ces URLs un jour.

## Supabase — état

- ✅ RLS activée sur **toutes** les tables ; nouvelles tables (`artist_suggestions`, `comment_edit_history`, `comment_report`) avec policies dès la migration.
- ✅ `scrape_log` : deny explicite (policy `using (false)`), service role pour les écritures.
- ✅ `service_role` key **server-only** (jamais `NEXT_PUBLIC_*`).
- ✅ `handle_new_user` : exécution RPC révoquée pour anon/authenticated (le trigger fonctionne toujours).
- 🟡 Advisors restants (acceptés / à traiter) :
  - `group_follow_counts` SECURITY DEFINER exécutable — **intentionnel** (agrégat de follows cross-users, aucune donnée d'identité exposée).
  - Extension `citext` dans `public` — déplacement risqué (colonne `username`) → différé.
  - Buckets publics `avatars`/`banners` autorisent le listing — resserrer la policy SELECT storage → follow-up (risque de casser l'affichage à tester).
  - **Leaked password protection désactivé** → **à activer dans le dashboard Supabase** (Auth → Password security). _Action Rudy._

## CSP report-only — durcissement futur

La CSP est en `Content-Security-Policy-Report-Only` (ne bloque rien, log les violations en console). Après observation des rapports en prod, passer en `Content-Security-Policy` (enforce) en retirant `'unsafe-inline'`/`'unsafe-eval'` si possible (Next 16 + nonces).

## Tests adversariaux — à mener avant ouverture publique

XSS dans commentaires/username/champs Contribute ; accès direct `/admin/*` sans rôle ; modification `tier`/`role` côté client (bloqué RLS) ; spam commentaires/votes ; vote sur son propre commentaire (bloqué) ; CSRF sur actions POST sensibles (Server Actions Next protègent via origine).
