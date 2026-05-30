# KStage — Plan de finalisation MVP

> Document à utiliser comme spécification exécutable pour Claude Code.
> À exécuter **par phases successives**, chaque phase auto-contenue et testable.
> Ce document complète le `CLAUDE.md` (règles de comportement + contexte projet).

---

## Décisions techniques actées (à ne PAS rediscuter)

- **Stack data** : migration des fichiers JSON vers **Supabase (PostgreSQL) + client `@supabase/supabase-js`**. Justification en Phase 1.
- **Algo "of the month"** : moyenne bayésienne (formule en §3.1)
- **Timezone** : stockage en UTC en DB, conversion locale à l'affichage et au tri
- **Validation inscription** : code 6 chiffres par email (expiration 15 min)
- **Limite follows** : 10 pour comptes free, illimité pour comptes premium (préparer le code, flag inactif tant que premium pas lancé)
- **Bias / groupe favori** : sélection parmi **tous** les groupes/membres en DB
- **Page MV — section "From your groups"** : 1 ligne par groupe suivi, 10 MV par ligne, scroll horizontal smooth

## Ordre d'exécution recommandé

1. **Phase 1** — Refactor stack data (fondations)
2. **Phase 2** — Auth, inscription, profil
3. **Phase 3** — Refonte des pages
4. **Phase 4** — Composants transverses
5. **Phase 5** — Data pipeline & scraping
6. **Phase 6** — Audit sécurité final

---

# PHASE 1 — Refactor stack data (priorité absolue)

## 1.1 Migration vers Supabase

**État actuel** : données en gros fichiers JSON. À remplacer.

**Problèmes** :

- Pas de query complexe (filtres, jointures, tri serveur-side)
- Pas de RLS → tout est lisible/écrivable depuis le client
- Pas de transactions (votes/commentaires concurrents = corruption possible)
- Pas de migration versionnée
- Pas de full-text search efficace
- Pas scalable au-delà de quelques Mo

**Cible** : Supabase

- PostgreSQL managé, free tier 500 MB + 2 GB transfer/mois
- Auth intégrée (utilisée à partir de la Phase 2)
- RLS pour la sécurité
- Real-time (utilisé pour Recent Activity en Phase 3)
- Client TS typé via `supabase gen types`

**Décision sur Prisma** : non pour l'instant. Le client Supabase JS est déjà typé et suffisant. Ajouter Prisma seulement si une limitation concrète apparaît plus tard.

### Étapes

1. Vérifier les credentials Supabase dans `.env.local` (projet déjà créé)
2. Définir le schéma SQL complet (§1.2) via migrations Supabase
3. Activer RLS sur toutes les tables avec données users
4. Écrire les policies (qui peut lire/écrire quoi)
5. Générer les types TS : `npx supabase gen types typescript --linked > types/supabase.ts`
6. Créer un client typé `lib/supabase/server.ts` et `lib/supabase/client.ts`
7. Écrire un script one-shot de migration des JSON existants vers Supabase
8. Remplacer progressivement les lectures/écritures JSON par des appels Supabase, fichier par fichier
9. Supprimer les fichiers JSON une fois la migration validée et testée

## 1.2 Schéma SQL cible

Base : modèle déjà défini dans `CLAUDE.md` §B.4 (Group, Member, Event, EventType, User, UserFollow, UserNotificationSetting, EventSuggestion, Source).

**Compléments à ajouter** :

```
comment (id, parent_id, user_id, target_type, target_id, content, created_at, updated_at, edited_at, deleted_at, status)
comment_edit_history (id, comment_id, previous_content, edited_at)
comment_vote (id, user_id, comment_id, value, UNIQUE(user_id, comment_id))
comment_report (id, comment_id, reporter_id, reason, status, reviewed_by, created_at)
mv_like (id, user_id, mv_id, created_at, UNIQUE(user_id, mv_id))
mv_vote (id, user_id, mv_id, value (1-10), created_at, UNIQUE(user_id, mv_id))
release_vote (id, user_id, release_id, value (1-10), created_at, UNIQUE(user_id, release_id))
monthly_winner (id, type ('mv'|'release'), period_month, winner_id, computed_at)
scrape_log (id, source, status, error_msg, started_at, ended_at)
```

**Champs à ajouter à `user`** :

- `username` (unique, requis, 3-20 chars, alphanumeric + underscore)
- `email_verified_at` (nullable, set après validation du code)
- `email_verification_code` (nullable, 6 chiffres, expire 15 min)
- `email_verification_attempts` (int, rate limit)
- `tier` (enum: 'free' | 'premium', default 'free')
- `role` (enum: 'user' | 'admin' | 'moderator', default 'user')
- `avatar_url`
- `bias_member_id` (nullable, FK vers `member`)
- `favorite_group_id` (nullable, FK vers `group`)
- `timezone` (IANA, ex: 'Europe/Paris')

Contraintes critiques :

- `user.email` unique
- `user.username` unique
- `comment_vote.UNIQUE(user_id, comment_id)` empêche les votes multiples
- Policy RLS : un user ne peut PAS voter son propre commentaire (vérifié au niveau DB, pas juste UI)

## 1.3 Convention timezone

- Toutes dates stockées en `timestamptz` (UTC en base)
- Données scrapées en heure KST → **conversion en UTC à l'ingestion**
- À l'affichage : conversion UTC → fuseau utilisateur, basée sur :
  - `user.timezone` si connecté
  - `Intl.DateTimeFormat().resolvedOptions().timeZone` sinon
- Format affichage : `HH:MM AM/PM TZ_ABBR` où `TZ_ABBR` est l'abréviation locale (CET, EDT, JST...) résolue via `Intl.DateTimeFormat(locale, { timeZoneName: 'short' })`
- **Le tri today/tomorrow/later doit se baser sur l'heure locale** de l'utilisateur, pas sur KST.
  - Bug actuel : un event du 31 à 00h KST apparaît "today" même quand l'utilisateur est encore le 30 chez lui. À corriger.

---

# PHASE 2 — Auth, inscription, profil

## 2.1 Inscription

### Champs du formulaire

- Email
- Username (unique, 3-20 chars, alphanumeric + underscore)
- Password (min 12 chars, au moins 1 majuscule, 1 chiffre)
- Password confirm (doit matcher)

### Validation par code email

1. À la soumission : créer le user en DB avec `email_verified_at = null`
2. Générer un code 6 chiffres aléatoire, le stocker avec expiration 15 min
3. Envoyer le code par email (Resend recommandé, free tier 3k mails/mois)
4. Page suivante : champ de saisie du code (6 chiffres)
5. Vérifier le code → set `email_verified_at = now()`, supprimer le code, rediriger vers `/upcoming`

### Sécurité

- Rate limit : max 5 tentatives de code par compte par 15 min
- Bouton "renvoyer le code" avec cooldown 60 sec
- Hash mot de passe géré par Supabase Auth (bcrypt sous le capot)
- Pas de leak d'info dans les erreurs ("email déjà utilisé" → message générique "si ce compte existe, un email a été envoyé")

## 2.2 Login

- Champ : email **ou** username + password
- Redirection après login : `/upcoming` (la page Upcoming devient la landing post-connexion)
- "Remember me" (session longue durée)
- Lien "Mot de passe oublié" → flux de reset par code email

## 2.3 Changement de credentials

Page accessible depuis le menu avatar (cf. §2.4).

**Changement password** : 3 champs (mdp actuel + nouveau mdp + confirmer nouveau mdp)

**Changement email** : nouveau email + mdp actuel pour confirmer + code de validation envoyé au nouvel email

## 2.4 Menu avatar (header)

Au clic sur l'avatar :

1. **Mon profil** → page profil public (§3.7)
2. **Paramètres** → page changement credentials (§2.3)
3. **Se déconnecter**

---

# PHASE 3 — Pages

## 3.1 Page Upcoming (landing après login)

### Layout

- **Inverser l'ordre** : `Filters` puis `My Groups` (au lieu de `My Groups` puis `Filters`)
- Bloc `My Groups` :
  - Limité à 10 follows visibles si `user.tier === 'free'`
  - Illimité si `user.tier === 'premium'` (préparer le code, flag inactif tant que premium pas activé)
  - **Supprimer les pastilles de couleur** à côté des noms de groupes

### Bannières d'événements

**Bug actuel** : le tag d'event s'affiche sur 2 lignes quand le nom du groupe est long.

**Refonte** : structure verticale **toujours sur 3 lignes** :

- Ligne 1 : tag (ex: "Comeback")
- Ligne 2 : nom du groupe
- Ligne 3 : nom de l'event

Hauteur de la bannière ajustée en conséquence. L'image de fond doit s'adapter (`background-size: cover`, recadrage automatique).

### Affichage des heures

- Format : `HH:MM AM CET` (abréviation locale dynamique, plus de "your time" en dur)
- Switch l'ordre actuel : **heure locale en premier, heure KST en secondaire**
- Le tri today/tomorrow/later se base sur l'heure locale (cf. §1.3)

### Performance des filtres

**Bug actuel** : filtrage lent + cursor inchangé au survol.

À faire :

- Audit du re-render (probablement re-render complet de la liste à chaque changement)
- `useMemo` sur la liste filtrée
- Virtualization si liste > 100 items (`react-window` ou équivalent)
- Debounce sur les inputs texte
- CSS : `cursor: pointer` sur tous les éléments cliquables (filtres, tags, etc.)

### Section "Later"

- Limiter à **10 bannières max**
- Limiter à **1 mois max** dans le futur
- Au-delà : afficher `+ X more events later` pointant vers `/calendar?date=YYYY-MM-DD` (date du dernier event affiché)

### Blocs "MV of [Previous Month]" et "Release of [Previous Month]"

#### Suppression du mock

Brancher sur les vraies données via la table `monthly_winner` (cf. §1.2).

#### Algorithme — moyenne bayésienne (IMDB-like)

Formule :

```
score = (v / (v + m)) * R + (m / (v + m)) * C
```

Où :

- `v` = nombre de votes pour cet item
- `R` = note moyenne de cet item (1-10)
- `m` = seuil minimum de votes pour qu'un item compte (recommandation initiale : **50**)
- `C` = note moyenne globale de tous les items du dataset (1-10)

Le `m` agit comme une régression vers la moyenne : un MV 10/10 avec 1 vote sera tiré vers `C`, alors qu'un MV 9/10 avec 1500 votes restera proche de 9.

#### Calcul mensuel

- Cron qui tourne **le 15 de chaque mois à 00:01 UTC**
- Calcule pour la période **1er au dernier jour du mois précédent**
- Insère le gagnant dans `monthly_winner` (un pour MV, un pour Release)
- L'app lit ce résultat caché, pas de recalcul à chaque page load

#### Nommage UI

- "MV of [Previous Month]" (ex: "MV of March")
- "Release of [Previous Month]"

### Bloc "Recent Activity"

- Supprimer le mock
- Brancher sur des données live : derniers commentaires, derniers likes/votes, dernières contributions validées, dernières inscriptions
- Limite : 10-15 items, antéchronologique
- Auto-refresh via Supabase Realtime (ou polling 30s en fallback)

### Bloc "Community Pulse"

**À supprimer.** Les suggestions vont dans le header via le bouton Contribute (cf. §4.3), le bloc n'a plus d'utilité.

## 3.2 Page Calendar

### Layout

- Reprendre le **template de la page Upcoming** : mêmes blocs latéraux (My Groups, Recent Activity, etc.)
- Reprendre **le même bloc Filters** que Upcoming
- Supprimer les filtres actuels propres à Calendar
- Ajouter dans Filters un champ **"Group"** (sélection d'un ou plusieurs groupes à afficher)
- **Supprimer le titre "Calendar"** en haut (redondant, la nav indique déjà la page)

## 3.3 Page MV

### Sections (dans l'ordre)

1. **From your groups** : 1 ligne par groupe suivi
   - 10 derniers MV par groupe
   - **Scroll horizontal smooth**, drag-to-scroll souris (impl maison avec `pointerdown/move/up` ou lib `react-horizontal-scrolling-menu`)
   - Lien **"See more"** à droite de chaque ligne → page du groupe correspondant
2. **Latest MVs (Global)** : 30 derniers MV sortis tous groupes confondus (grid responsive, ~10 par ligne)

### Layout

- Template Upcoming (blocs latéraux)
- **Pas de bloc Filters** sur cette page

## 3.4 Page Groups

### Layout

- **Supprimer le titre "Groups"** en haut
- Toggle **"Groups" / "Solo"** : segmented control moderne, transition fluide au changement
- Template Upcoming (blocs latéraux), **sauf Filters** (pas de bloc Filters ici)

### Cards

- **Grille 3 colonnes**
- Format **carré**, image du groupe/artiste remplissant la card
- Nom en overlay sur l'image, avec fond semi-transparent ou drop-shadow pour rester lisible
- **Bouton follow : icône cœur uniquement** (pas de texte). Cœur rempli rouge si followed, vide sinon
- Animations hover (slight scale, glow ou fade overlay)

### Tri

Boutons de tri :

- Alphabétique (A-Z)
- Popularité (nombre de follows, desc)
- Date de debut (desc)

### Sync My Groups

Quand l'user follow/unfollow depuis cette page, le bloc latéral `My Groups` doit se mettre à jour **sans reload de la page**. Utiliser un state global (Zustand ou Context) ou Next.js Server Actions avec `revalidatePath`.

## 3.5 Page Artist (groupe ou solo)

### Structure (dans l'ordre)

1. **Bandeau** : image récente de l'artiste en fond, nom en titre
2. **Bouton follow** : cœur uniquement, **mis en évidence** (plus grand que sur la card de Groups)
3. **Info artiste** : agence, date de debut, fandom name
4. **Membres du groupe** (si groupe) : grille de cards membre cliquables → page membre
5. **Events** : 10 prochains events de l'artiste
6. **MV** : 15 derniers MV (filtrer sur titre contenant "MV" ou "Official Music Video"), avec lien **"Show all"** pour voir tout

## 3.6 Page MV (détail d'un MV)

- Template Upcoming (blocs latéraux)
- Header du MV : **remplacer la pastille de couleur** à côté du nom de l'uploader par **l'image du groupe**
- **Cadre "Like" du MV** : distinct du système de votes 1-10, juste un like/unlike binaire
- Section commentaires (cf. §4.4)

## 3.7 Page Profil

### Layout

- **Bandeau profil** : design calqué sur le bandeau artiste
- **Photo de profil grande**, au hover → curseur pointer + indication d'action. Au clic → modale de changement de PP
- Cadres dans le bandeau pour :
  - **Bias** : modale de sélection parmi **tous les membres** en DB (avec recherche par nom + avatars)
  - **Favorite group/artist** : modale de sélection parmi **tous les groupes/solo artists** en DB (avec recherche + avatars)
  - UX/UI des modales laissée libre, doit être fluide et moderne
- **Infos affichées dans le bandeau** :
  - "Member since [date d'inscription]"
  - "X comments" (nombre total de commentaires postés par l'user)

### Sous le bandeau

- **30 derniers MV likés** par l'user
- Lien **"See X more"** → page complète des likes si > 30

### Settings affichés sur cette page

- **Toggle Daily Notifications** (ex-page My Events)
- **Bouton Admin** si `user.role === 'admin'` (ex-page My Events)

## 3.8 Page My Events

**Action : SUPPRIMER la page.**

- Landing post-login : `/upcoming`
- Daily Notifications → déplacé dans Profil (§3.7)
- Bouton Admin → déplacé dans Profil (§3.7), visible si admin

---

# PHASE 4 — Composants transverses

## 4.1 Header

### États

- **Déconnecté** : logo, nav, boutons "Log in" + "Sign up"
- **Connecté** : logo, nav, bouton "Contribute" (§4.3), avatar dropdown (§2.4)
- Les boutons login/sign up **disparaissent** quand l'user est connecté

### Audit à faire

- Responsive mobile-first
- Accessibilité (focus visible, navigation clavier, contrastes)
- Cohérence design avec le reste de l'app

## 4.2 Footer

Créer un footer avec :

- About
- Terms of Service
- Privacy Policy
- Cookie Policy (si tracking)
- Contact (mailto ou page)
- Lien Twitter/X de KStage
- Mention "Projet indé, non affilié aux agences mentionnées"
- Copyright + année

## 4.3 Bouton "Contribute" (ex-Suggest)

### Renommage

`+ Suggest` → **`Contribute`**

### Sous-menu (3 boutons au clic)

1. **Artist** — formulaire de suggestion d'un nouvel artiste
2. **Event** — formulaire de suggestion d'un nouvel event
3. **Fix** — formulaire de signalement de problème

### Formulaire Artist

Champs alignés sur le schéma DB `Group` (et `Member` si applicable) :

- Nom (requis)
- Type (group / solo)
- Agence
- Date de debut
- Fandom name (optionnel)
- Couleur officielle (color picker, optionnel)
- URL image
- Membres (sub-form si group : stage_name + birthday + position)
- Source(s) URL

### Formulaire Event

Champs alignés sur le schéma DB `Event` :

- Groupe concerné (dropdown depuis la DB)
- Type d'event (enum: COMEBACK | MUSIC_SHOW | LIVE | ANNIVERSARY | CONCERT | OTHER)
- Titre
- Description (optionnel)
- Date/heure de début (avec timezone selector, default KST)
- Date/heure de fin (optionnel)
- URL source

### Formulaire Fix

- Champ texte large (textarea), limite **2000 caractères** avec compteur visible
- Champ source URL (optionnel)
- **Pas de validation/rejet** : c'est de la lecture seule pour les admins

### Page admin "Moderate suggestions"

- Liste des suggestions Artist + Event en attente
- Pour chaque suggestion : voir détails, **éditer**, accepter (insert en DB), rejeter
- Liste séparée des Fix : lecture seule, marquer "vu" / "traité"

## 4.4 Commentaires (système Reddit-like)

### Threading

- Fil hiérarchique : commentaire parent → réponses → sous-réponses
- Bouton expand/collapse sur chaque thread (`[-]` / `[+]` à la Reddit)
- Au-delà de **5 réponses** dans un même thread : cacher les suivantes, afficher "Show X more replies"

### Sauts de ligne

Choix retenu : **conserver les sauts de ligne dans l'affichage**, mais **limiter à 3 sauts de ligne consécutifs max**. Parser côté serveur : remplacer `\n{4,}` par `\n\n\n` avant insertion en DB. Évite les messages géants qui cassent la page.

### Édition d'un commentaire

- Affichage "edited at HH:MM" sous le commentaire édité
- Bouton "View history" → modale qui montre les versions précédentes (depuis `comment_edit_history`)

### Affichage

- **Avatar de l'auteur** à côté du pseudo
- Clic sur avatar OU pseudo → redirection vers le profil de l'user

### Votes

- Upvote / downvote
- **Empêcher l'auto-vote** : un user ne peut pas voter son propre commentaire
  - Vérification au niveau policy RLS Supabase (pas juste UI)

### Modération

- Lien **"Report"** sur chaque commentaire → crée une entrée dans `comment_report`
- Interface admin pour traiter les reports (accepter → soft-delete du commentaire, rejeter → marquer comme légitime)

### Anti-spam / modération auto

Implémenter en deux temps :

- **Phase initiale** (à inclure dans cette finalisation) :
  - Filtre regex basique sur mots-clés (liste configurable côté admin)
  - Rate limit : max **5 commentaires par minute** par user
- **Phase V2** (plus tard, pas dans ce MVP) :
  - Intégration Perspective API (Google, gratuite) pour scorer la toxicité automatiquement

### Références design

S'inspirer de **Reddit (principalement)**, HLTV, RFT.gg, VLR.gg pour le rendu visuel.

---

# PHASE 5 — Data pipeline & scraping

## 5.1 Sources principales + fallback

Pour chaque type de donnée critique, **une source principale + une source secondaire**. Si la principale échoue, fallback automatique sur la secondaire.

| Donnée        | Source principale         | Source secondaire                             |
| ------------- | ------------------------- | --------------------------------------------- |
| Comebacks     | dbkpop.com                | YouTube Data API + comptes Twitter officiels  |
| Music shows   | liveshowupdatess.carrd.co | Sites officiels (Mnet, KBS, MBC, SBS)         |
| Lives         | YouTube Data API          | Weverse (scraping)                            |
| Anniversaires | Saisie manuelle           | (rare changement, pas de fallback nécessaire) |

### Implémentation

- Chaque source dans un module isolé : `lib/scrapers/dbkpop.ts`, `lib/scrapers/liveshow.ts`, etc.
- Wrapper haut niveau : tente la source principale, fallback sur secondaire en cas d'échec ou timeout (5s)
- Chaque tentative loggée dans `scrape_log` (timestamp, source, status, error_msg, durée)

## 5.2 Music shows — numéro d'épisode

Capter le numéro d'épisode si présent dans le titre (ex: "Inkigayo 328").

- Pattern de scraping à ajuster pour extraire le numéro
- Champ optionnel `episode_number` (nullable int) dans la table `Event`
- Affichage dans le titre : `Inkigayo #328` ou `Inkigayo ep. 328`

---

# PHASE 6 — Audit sécurité

Mener cet audit **avant le lancement public**. Checklist OWASP Top 10 + spécifiques Supabase + tests adversariaux.

## 6.1 OWASP Top 10

1. **Broken Access Control** : audit complet des policies RLS Supabase. Aucune table user-data sans RLS. Tester depuis le client en se faisant passer pour un autre user.
2. **Cryptographic Failures** : passwords hashés via Supabase Auth (OK par défaut). Aucune donnée sensible en clair.
3. **Injection** : aucune query SQL brute. Tout input HTML (commentaires, profil, contributions) sanitizé côté serveur via `dompurify` ou équivalent.
4. **Insecure Design** : rate limiting sur toutes les routes API publiques (login, signup, comment, vote, report, contribute). Utiliser `@upstash/ratelimit` ou middleware Next.js.
5. **Security Misconfiguration** : `.env.local` jamais committé, secrets dans Vercel uniquement. HTTPS forcé en prod. Headers sécurité (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) configurés dans `next.config.js`.
6. **Vulnerable Components** : `npm audit` régulier, dépendances à jour. CI qui bloque les merges sur vulnérabilités hautes/critiques.
7. **Identification and Authentication Failures** : rate limit login (5 essais / 15 min / IP), code de validation expirant à 15 min, sessions JWT signées.
8. **Software and Data Integrity Failures** : lockfile committé. Pas de package depuis sources non vérifiées.
9. **Logging and Monitoring** : log des actions critiques (login, signup, contribution, modération, suppression). Sentry pour les erreurs serveur.
10. **Server-Side Request Forgery** : si scraping côté serveur prend une URL user (cas du champ "source" dans Contribute), valider strictement (whitelist de domaines + rejet des IPs internes type 10.x, 192.168.x, 127.x).

## 6.2 Spécifique Supabase

- RLS activée sur **TOUTES** les tables
- Policies testées (un user ne doit pas pouvoir lire/écrire des données d'un autre user, sauf data publique)
- **Service role key JAMAIS exposée** côté client (jamais préfixée `NEXT_PUBLIC_*`)
- Audit avec l'outil "Database Linter" de Supabase
- Vérifier qu'aucune table ne contourne RLS via API publique

## 6.3 Tests adversariaux à mener

Avant lancement, simuler un attaquant et tenter :

- **SQL injection** dans tous les champs textuels (commentaires, profil, formulaires Contribute, username)
- **XSS** (script dans commentaire, dans username, dans bias text)
- **Accès direct aux routes admin** sans rôle admin
- **Modification du `user.tier`** côté client (devrait être bloqué par RLS)
- **Spam** : commentaires en boucle, votes en masse, inscriptions multiples
- **Vote/like sur ses propres contenus**
- **Bypass de la limite de 10 follows** côté client (devrait être bloqué côté serveur aussi)
- **CSRF** sur les actions POST sensibles (changement password, email)

---

# Conventions de travail (rappel)

- Cf. `CLAUDE.md` Partie A : réfléchir avant, simplicité d'abord, changements chirurgicaux, exécution orientée objectif
- **Une branche par phase** (`feat/phase1-supabase`, `feat/phase2-auth`, etc.), sous-branches par sous-section si phase grosse
- Commits petits et atomiques
- Avant chaque commit : `npm run lint` + `npm run typecheck` doivent passer
- **Migration JSON → Supabase** : créer une branche dédiée, ne pas merger avant que TOUT soit migré, testé, et les anciens fichiers JSON supprimés

# Hors scope (pour mémoire, V2)

- Génération programmatique de visuels sociaux (style RFT.gg) — sous-projet séparé, à reprendre plus tard
- Intégration Twitter API pour auto-tweet des nouveaux comebacks
- Modèle premium effectif (paiement Stripe) — code préparé, activation V2
- Perspective API pour modération auto avancée
- App mobile native (la PWA suffit pour l'instant)
- API B2B publique
