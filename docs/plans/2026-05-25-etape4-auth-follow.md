# Étape 4 — Auth + Follow groupes

> Plan d'implémentation. Contexte produit : `docs/PROJECT.md` §6 (roadmap, étape 4). Décisions de scope validées avec l'user le 2026-05-25.

## Scope verrouillé

- **Auth** : email/password uniquement. Google OAuth reporté (marqué "bonus" dans PROJECT.md).
- **Confirmation email** : **désactivée** (auto-confirm) au MVP. Étape manuelle dans le dashboard Supabase (Auth → Providers → Email → "Confirm email" off). Réactivation prévue à l'étape 9 avec un vrai mailer.
- **Timezone** : pas de stockage DB. `LocalTime` affiche déjà en heure navigateur (`Intl`). Colonne timezone ajoutée à l'étape 6 (notifs serveur), quand un consommateur côté serveur existera.
- **Vue "mes events"** : nouvelle route `/my` (la home `/` reste la découverte globale, utile déconnecté et pour trouver des groupes à suivre).
- **Follow UX** : Server Action + `useOptimistic` (bascule instantanée, pas de reload de segment).

## Schéma & config

**Aucune migration.** `user_follows` (PK `(user_id, group_id)`, FK `auth.users`) + sa policy RLS "own rows" existent depuis l'étape 2. Pas de table `profiles` (email-only, pas de display name au MVP).

Seule action hors-code : désactiver la confirmation email dans le dashboard Supabase.

## Fichiers

Nouveaux :

- `src/lib/auth/actions.ts` — `signUp`, `signIn`, `signOut` (server actions).
- `src/lib/follows/actions.ts` — `toggleFollow` (server action).
- `src/lib/follows/queries.ts` — `getFollowedGroupIds`, `getUpcomingEventsForUser`.
- `src/components/auth/auth-form.tsx` — `'use client'`, `useActionState`, partagé login/signup.
- `src/components/auth/auth-menu.tsx` — contrôle header : email + logout, ou "Se connecter".
- `src/components/follow-button.tsx` — `'use client'`, `useOptimistic` + `toggleFollow`.
- `src/app/login/page.tsx`, `src/app/signup/page.tsx`.
- `src/app/my/page.tsx` — feed perso (guard `redirect`).

Modifiés :

- `src/app/layout.tsx` — `getUser()` → `isAuthed` à `SiteNav` + `<AuthMenu>` dans le header.
- `src/components/site-nav.tsx` — item "Mes events" si connecté.
- `src/components/group-card.tsx` — sépare zone-lien / `FollowButton` (un `<button>` ne peut pas être imbriqué dans le `<Link>` actuel).
- `src/app/groups/page.tsx` — passe l'état "suivi" + `isAuthed` aux cards.
- `src/app/groups/[slug]/page.tsx` — `FollowButton` sur la page détail.

## Détails

### Auth

- Actions via `supabase.auth.signUp` / `signInWithPassword` (cookies posés par le client SSR), puis `redirect('/my')`. `signOut` → `redirect('/')`. Retour `{ error?: string }`.
- `auth-form.tsx` : `useActionState`, prop `mode`, affiche les erreurs Supabase. Validation légère (email non vide, password ≥ 6).
- `/login` et `/signup` : shell serveur + form, lien croisé.

### Follow

- `toggleFollow(groupId, isFollowing)` : user absent → `redirect('/login')` ; sinon `insert`/`delete` `user_follows` ; `revalidatePath('/my')`.
- `getFollowedGroupIds(userId)` → `Set<string>`. `getUpcomingEventsForUser(userId, …)` → events à venir filtrés `in (groupes suivis)`.
- `<FollowButton groupId initialFollowing isAuthed>` : non connecté → lien `/login` ; connecté → `useOptimistic` + action.

### /my

Server Component. `getUser()` absent → `redirect('/login')`. `getFollowedGroupIds` vide → empty state. Sinon → events à venir des groupes suivis via `EventList`. Pas de filtres au départ (MVP).

### Nav / layout

Layout serveur `getUser()` → `isAuthed` à `SiteNav` (item "Mes events") + `<AuthMenu>` (connecté : email + logout via form `signOut` ; sinon : lien "Se connecter").

### Erreurs

Auth : messages via `useActionState`. Follow non authentifié : `redirect('/login')`. Erreur DB : error boundary existante ; l'optimiste se réaligne au revalidate.

## Tests

- **Vitest** : validation légère des inputs auth (logique pure).
- **Playwright golden path** : login → follow un groupe → présent dans `/my` → logout.
- **Data e2e** : compte test fixe et confirmé via env (`E2E_AUTH_EMAIL` / `E2E_AUTH_PASSWORD`), flux **login** (pas signup). Skip propre si non configuré → CI verte. Choix retenu après que Supabase a rejeté les emails `@example.com` au signup (validation stricte) : un compte fixe évite à la fois la validation d'email et la dépendance à l'auto-confirm.

> ⚠️ E2E : ne jamais laisser un `npm run dev` ouvert pendant `npm run test:e2e` (Next 16 refuse un 2ᵉ serveur dev → le `webServer` Playwright échoue).
