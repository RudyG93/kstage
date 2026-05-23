# CLAUDE.md — KStage / K-Era

> Lu automatiquement par Claude Code à chaque démarrage.
> **Partie A** : règles de comportement (comment coder).
> **Partie B** : contexte du projet (quoi coder).
> Voir aussi `AGENTS.md` : avertissement spécifique Next.js 16 ajouté par le scaffolder.

---

# PARTIE A — Règles de comportement

Guidelines pour réduire les erreurs LLM courantes en code. À combiner avec les instructions projet ci-dessous.

**Tradeoff** : ces règles privilégient la prudence à la vitesse. Pour les tâches triviales, utiliser le jugement.

## A.1 Réfléchir avant de coder

**Ne pas supposer. Ne pas masquer la confusion. Faire émerger les tradeoffs.**

Avant d'implémenter :
- Énoncer les hypothèses explicitement. Si incertain, demander.
- Si plusieurs interprétations sont possibles, les présenter — ne pas choisir silencieusement.
- Si une approche plus simple existe, le dire. Pousser back quand c'est justifié.
- Si quelque chose n'est pas clair, stopper. Nommer ce qui pose problème. Demander.

## A.2 Simplicité d'abord

**Le minimum de code qui résout le problème. Rien de spéculatif.**

- Pas de features au-delà de ce qui est demandé.
- Pas d'abstractions pour du code à usage unique.
- Pas de "flexibilité" ou "configurabilité" non demandée.
- Pas de gestion d'erreurs pour des scénarios impossibles.
- Si 200 lignes pourraient en faire 50, réécrire.

Test : *"Un senior engineer dirait-il que c'est sur-compliqué ?"* Si oui, simplifier.

## A.3 Changements chirurgicaux

**Toucher uniquement ce qui est nécessaire. Nettoyer uniquement son propre désordre.**

Quand on édite du code existant :
- Ne pas "améliorer" le code adjacent, les commentaires, le formatage.
- Ne pas refactorer ce qui n'est pas cassé.
- Respecter le style existant, même si on ferait autrement.
- Si on remarque du dead code non lié, le signaler — ne pas le supprimer.

Quand les changements créent des orphelins :
- Supprimer les imports/variables/fonctions rendus inutilisés **par nos changements**.
- Ne pas supprimer du dead code préexistant sans qu'on le demande.

Test : chaque ligne modifiée doit tracer directement à la demande de l'utilisateur.

## A.4 Exécution orientée objectif

**Définir des critères de succès. Boucler jusqu'à vérification.**

Transformer les tâches en objectifs vérifiables :
- "Ajouter une validation" → "Écrire les tests pour entrées invalides, puis les faire passer"
- "Fixer le bug" → "Écrire un test qui le reproduit, puis le faire passer"
- "Refactorer X" → "S'assurer que les tests passent avant et après"

Pour les tâches multi-étapes, énoncer un plan bref :

```
1. [Étape] → vérif : [check]
2. [Étape] → vérif : [check]
3. [Étape] → vérif : [check]
```

Des critères de succès forts permettent de boucler en autonomie. Des critères faibles ("faire que ça marche") nécessitent des clarifications constantes.

**Ces règles fonctionnent si** : moins de changements inutiles dans les diffs, moins de réécritures liées à la sur-complication, et les questions de clarification arrivent avant l'implémentation plutôt qu'après les erreurs.

---

# PARTIE B — Contexte du projet

## B.1 Vision

### Concept
Application web (PWA mobile-first) qui permet aux fans de k-pop de **suivre les events de leurs groupes favoris** dans un calendrier personnalisé, avec notifications push.

### Positionnement
**Outil personnel**, pas une base de données encyclopédique. Différenciation claire face aux concurrents :

- **kpopping** : média éditorial chargé, calendrier global non personnalisable
- **dbkpop** : liste statique de comebacks, pas de notifs ni filtrage
- **kprofiles** : wiki encyclopédique, pas un calendrier
- **biasroom** : photocards, hors sujet schedule

Angle : *"Google Calendar conçu pour les fans de k-pop"* — tu suis tes groupes, l'app filtre tout le reste, te notifie au bon moment dans ton fuseau horaire.

### Public cible
Fans k-pop occidentaux, principalement mobile. Marché niche mais passionné. MVP francophone-friendly mais UI en anglais (standard du fandom international).

### Nom (à trancher)
Candidats : **KStage** ou **K-Era**. Dispo des domaines à vérifier (`.app`, `.io` plus probables que `.com`).

---

## B.2 Scope du MVP

### Groupes au lancement (4)
- **aespa** (SM Entertainment)
- **ILLIT** (HYBE / Belift Lab)
- **Babymonster** (YG Entertainment)
- **(G)I-DLE** (Cube Entertainment)

Choix volontaire : mix générations (3e/4e gen) et éditeurs (SM/HYBE/YG/Cube) pour tester la pipeline sur des écosystèmes différents.

### Types d'events couverts au lancement
1. **Comebacks** (album, single, MV) — *essentiel*
2. **Music shows** (M Countdown, Music Bank, Show Champion, Inkigayo, Music Core, The Show) — *essentiel, gros volume hebdo*
3. **Lives officiels** (YouTube premieres, Weverse Live programmés)
4. **Anniversaires** (debut date, members)

Reporté en V2 : concerts, fanmeetings, tournées, variety shows, award shows, sub-units.

### Features MVP
- Liste/calendrier des events filtrables
- Auth utilisateur (email/password ou OAuth)
- Follow/unfollow groupes
- Vue personnalisée "mes events à venir"
- Notifications push (J-1, J-jour, custom)
- Gestion timezone utilisateur
- PWA installable, mode hors-ligne basique

### Modèle de contenu : hybride
- **80% automatisé** via scraping/APIs
- **20% communautaire** via suggestions utilisateurs validées en admin (modération asynchrone)
- L'app est **utile dès le jour 1 sans aucun user contributeur**

---

## B.3 Stack technique

- **Frontend** : Next.js (App Router) + TypeScript + React
- **Styling** : Tailwind CSS
- **Backend / DB** : Supabase (PostgreSQL + Auth + Storage)
- **Hébergement** : Vercel
- **PWA** : `@serwist/next` (ou `next-pwa` si problèmes)
- **Notifs push** : Web Push API + service worker
- **Cron/scraping** : Vercel Cron Jobs ou GitHub Actions selon coût
- **Repo** : GitHub (privé au début, public à la sortie MVP éventuellement)

### Notes PWA
- Manifest + service worker + Web Push API
- iOS : notifs push uniquement depuis iOS 16.4+ et seulement si app "installée" sur l'écran d'accueil → bien guider les users iPhone à l'install

---

## B.4 Modèle de base de données (initial)

```
Group (id, name, slug, debut_date, agency, fandom_name, color_hex, image_url, ...)
Member (id, group_id, stage_name, real_name, birthday, position, ...)
Event (id, group_id, type, title, description, start_at, end_at, source_url, image_url, status, ...)
EventType : COMEBACK | MUSIC_SHOW | LIVE | ANNIVERSARY | CONCERT | OTHER
User (id, email, timezone, locale, created_at, ...)
UserFollow (user_id, group_id, created_at)
UserNotificationSetting (user_id, event_type, lead_time_minutes, channel, enabled)
EventSuggestion (id, user_id, group_id, type, title, start_at, status, reviewed_by, ...)
Source (id, name, url, type, last_scraped_at, ...)
```

**Principe** : commencer simple, étendre seulement quand un besoin concret apparaît. Pas de sur-modélisation (sub-units, parent companies, etc.) tant que pas nécessaire.

---

## B.5 Sources de données

### Comebacks
- **dbkpop.com** (scraping) : agrégateur le plus fiable, page "comeback calendar"
- **YouTube Data API** (officielle, gratuite, quota suffisant) : surveille les chaînes officielles, capture les "Premieres" programmées avec date/heure exacte
- **Comptes Twitter/X officiels** (backup, plus tard) : `@aespa_official`, `@ILLIT_official`, `@YG_BABYMONSTER`, `@G_I_DLE`

### Music shows
- Sites officiels (mnetplus, KBS, SBS, MBC, SBS MTV, MBC M)
- Lineups annoncés mardi-mercredi pour la semaine
- Scraping nécessaire (pas d'API)

### Lives
- **YouTube Data API** pour les premieres
- **Weverse** : pas d'API publique, scraping nécessaire

### Anniversaires
- **Saisie manuelle** une fois (statique, ~30 dates pour les 4 groupes)
- Mise à jour si line-up change (rare)

### Stratégie scraping
- Cron 1-2× par jour, pas plus (respect des sites)
- Cache agressif côté DB
- Respect `robots.txt`
- Isoler chaque source dans son propre module pour réparer vite quand une structure change
- Logguer les erreurs (Sentry ou simple table `scrape_log`)
- Prévoir un fallback manuel quand une source casse

---

## B.6 Roadmap MVP

Étapes dans l'ordre, chaque étape produit quelque chose de testable :

1. **Setup projet**
   - Init Next.js + TS + Tailwind
   - Init repo GitHub
   - Init projet Supabase
   - Connexion Vercel
   - Variables d'environnement (`.env.local`, secrets Vercel)

2. **Modèle de données + seed manuel**
   - Migrations Supabase pour les tables core
   - Seed des 4 groupes avec quelques events fictifs
   - Client Supabase typé (génération des types TS)

3. **Frontend basique**
   - Page d'accueil : liste des events à venir
   - Page groupe : détails + ses events
   - Filtres par groupe et par type d'event
   - Vue calendrier mensuelle

4. **Auth + Follow groupes**
   - Auth Supabase (email/password minimum, OAuth Google bonus)
   - Table `UserFollow` + UI follow/unfollow
   - Vue "mes events" filtrée
   - Gestion timezone utilisateur

5. **Première pipeline de scraping**
   - 1 source d'attaque (suggestion : YouTube Data API)
   - API route protégée par token
   - Vercel Cron
   - Logging + idempotence (pas de doublons)

6. **Notifications push**
   - Manifest PWA + service worker
   - Abonnement push utilisateur
   - Envoi côté serveur (cron qui check les events à venir)
   - Préférences utilisateur (lead time, types)

7. **Sources supplémentaires** (une par une)
   - dbkpop pour les comebacks
   - Sites des music shows
   - Weverse pour les lives

8. **Système de suggestions communautaires**
   - Form utilisateur
   - Interface admin valider/rejeter
   - Notif au contributeur quand validé

9. **Polish + lancement**
   - SEO de base
   - Page d'accueil marketing
   - Analytics (Plausible ou similaire, RGPD-friendly)
   - Lancement soft (Reddit r/kpop, Twitter, fans des 4 groupes)

---

## B.7 Conventions projet

### Code
- **TypeScript strict** activé
- **ESLint + Prettier** configurés dès le départ
- Composants : `PascalCase`, fichiers : `kebab-case` (ou conventions Next.js App Router)
- Pas de `any` sauf cas exceptionnel commenté

### Git
- **Branche par feature** : `feat/auth`, `feat/scraping-youtube`, `fix/timezone-bug`
- Commits clairs (français ou anglais, mais cohérent)
- Commits réguliers, petits, atomiques
- PR vers `main` même en solo (force la relecture)

### Sécurité
- **Pas de secrets dans le repo** — `.env.local` dans `.gitignore`
- Supabase RLS (Row Level Security) activé sur toutes les tables avec données users
- Tokens d'API en variables d'environnement Vercel
- Rate limiting sur les routes publiques d'API

### Performance
- Images optimisées via `next/image`
- ISR / cache agressif sur les pages publiques d'events
- Pagination dès qu'il y a des listes (50+ items)

---

## B.8 Pièges identifiés à éviter

- **Sur-modélisation de la DB** : pas de sub-units, agencies parents, etc. tant que pas nécessaire
- **Couvrir trop de groupes au lancement** : 4 c'est le bon nombre, étendre par demande user
- **Compter sur la communauté comme source principale** : c'est un bonus, pas le moteur (cold start)
- **Construire des notifs avant pipeline scraping stable** : pas de notif fiable sans data fiable
- **Burnout d'enthousiasme initial** : rythme soutenable > sprint qui s'éteint
- **Reporter le déploiement** : déployer dès l'étape 1 sur Vercel, même si c'est "Hello World"
- **Ignorer iOS pour la PWA** : tester l'install iPhone tôt, c'est là que les surprises arrivent

---

## B.9 Profil du développeur

- Sortie de formation **OpenClassrooms — Développeur d'application web (RNCP niveau bac+3/4)**
- Stack principale apprise : **React / Next.js**
- Beaucoup de temps libre disponible
- Premier vrai projet perso d'envergure post-formation
- Objectif double : produit fonctionnel + portfolio pro
- **Préfère le tutoiement, réponses concises, paragraphes courts**
- **Veut être contredit quand il se trompe** plutôt que validé par défaut

---

## B.10 État actuel

**Phase** : étape 1 (Setup projet) — local terminé.

- ✅ Next.js 16.2.6 + TS + Tailwind v4 + App Router + `src/` + alias `@/*` scaffoldés
- ✅ `git init` + commit initial (par `create-next-app`)
- ✅ `.gitignore` complété, `.env.example` créé
- ⏳ Repo GitHub à créer + remote
- ⏳ Projet Supabase à créer + secrets dans `.env.local`
- ⏳ Connexion Vercel + secrets

**Prochaine action** : créer le repo GitHub et brancher le remote, puis créer le projet Supabase.
