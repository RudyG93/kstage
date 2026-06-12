# KStage — Fixes & Polish (suite du plan de finalisation MVP)

> Document **complémentaire** à `KSTAGE_MVP_FINALIZATION.md`.
> Contient les retours après tests utilisateurs (UX, bugs, polish).
> À traiter **après les phases en cours** ou en parallèle si le scope se chevauche.
> Respecter les règles de comportement du `CLAUDE.md` (réfléchir avant, simplicité, chirurgical, orienté objectif).

---

## Décisions techniques actées (à ne PAS rediscuter)

- **Champ de saisie OTP** : 6 cases séparées (pattern Discord/Twitch), auto-focus sur la case suivante, paste auto-fill, input mode numeric
- **Persistence des filtres user** : `localStorage` (pas besoin de DB pour ce scope)
- **Drag-to-scroll horizontal** : implémentation native via pointer events, ou lib `react-horizontal-scrolling-menu` si trop lourd
- **Mail post-validation inscription** : envoyé via edge function Supabase ou appel direct API Resend (pas géré nativement par Supabase Auth)

---

# Section 1 — Inscription / Auth (suite Phase 2)

## 1.1 UX du formulaire d'inscription

- **Toggle voir/cacher** sur les champs password (`type=password` ↔ `type=text`)
- Icône œil / œil barré (lucide-react : `Eye` / `EyeOff`)
- Toggle indépendant sur chaque champ (password et confirm password)

## 1.2 UX du champ OTP

Remplacer le champ texte unique actuel par un composant **6 cases séparées** :

- 6 inputs distincts, un chiffre par case
- `inputMode="numeric"` et `pattern="[0-9]*"` pour clavier numérique mobile
- **Auto-focus** sur la case suivante après saisie d'un chiffre
- **Auto-back** sur la case précédente au Backspace si la case courante est vide
- **Paste auto-fill** : coller un code à 6 chiffres remplit les 6 cases
- Désactivation visuelle des cases pendant la vérification serveur (loading state)
- Affichage d'erreur global sous les cases (pas par case)

Références d'implémentation : `shadcn/ui Input OTP` ou `react-otp-input`. Choisir la solution la plus légère et accessible.

## 1.3 Cooldown du bouton "Renvoyer le code"

- Cooldown de **60 secondes** entre deux envois
- Bouton désactivé pendant le cooldown
- Affichage dynamique : `Renvoyer le code (52s)` avec compteur qui décroît
- Une fois à 0 : bouton réactivé, texte redevient `Renvoyer le code`

## 1.4 Récupération de session de vérification

**Problème** : si l'user ferme la page entre la création du compte et la saisie du code, il est bloqué.

**Solution attendue** :

1. Page `/signup/verify` accessible directement (pas seulement par redirection automatique)
2. Si un user revient sur le site avec un compte en état "pending verification" (Supabase : `email_confirmed_at = null`), **redirection automatique** vers `/signup/verify` avec son email pré-rempli (depuis la session ou le contexte d'auth)
3. Le **mail OTP** doit contenir un rappel textuel du style :
   > Si tu as fermé la page, tu peux saisir ce code sur **https://kstage.app/signup/verify**
4. Sur la page `/signup/verify`, si l'user n'a pas de session active, autoriser la saisie manuelle de l'email + code

**Critère d'acceptation** : un user peut s'inscrire, fermer toutes les pages/onglets, rouvrir le site 10 minutes plus tard (avant expiration du code à 15 min), et finaliser sa vérification sans recréer de compte.

## 1.5 Mail de bienvenue post-validation

Une fois la validation OTP réussie, envoyer un **second mail** :

- Sujet : `Welcome to KStage!` (à adapter)
- Contenu : confirmation que le compte est actif, liens utiles (page Upcoming, Contribute, profil), invitation à suivre des groupes
- Design cohérent avec le mail OTP

**Implémentation** : ce mail n'étant pas géré nativement par Supabase Auth, deux options :

- **Option A (recommandée)** : edge function Supabase déclenchée par un trigger `AFTER UPDATE ON auth.users WHEN OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL`. La function appelle l'API Resend pour envoyer le mail.
- **Option B** : appel direct à l'API Resend depuis le code Next.js après confirmation du code OTP côté client. Plus simple mais moins fiable (dépend du client).

Choisir A si raisonnablement faisable.

## 1.6 Fix `display_name` dans Supabase Auth

**Problème** : le username n'apparaît pas dans le `display_name` visible sur le dashboard Supabase Auth.

**Cause** : l'inscription stocke probablement le username uniquement dans `user_metadata.username` mais pas dans `display_name`.

**Fix** : au moment du `signUp()`, passer explicitement le username dans `data` :

```ts
await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: username,
      username: username, // garde aussi cette clé pour le trigger DB
    },
  },
})
```

Le trigger `handle_new_user` doit ensuite copier `raw_user_meta_data->>'username'` vers la colonne `username` de la table `user` publique (déjà fait dans la migration `0018` selon Claude Code).

## 1.7 Template du mail OTP

Rendre le mail OTP **plus stylé**. Pas de contraintes fortes, laisser proposer :

- Identité visuelle KStage (logo, couleur d'accent kpop)
- Code 6 chiffres mis en évidence (grosse taille, lettré, fond contrasté)
- Layout responsive mobile-first
- Fallback texte brut (`{{ .Token }}` sans HTML pour les clients qui n'affichent pas le HTML)
- Mention du lien de récupération (cf. §1.4)
- Mention "code valable 15 minutes"
- Mention "si tu n'es pas à l'origine de cette inscription, ignore ce mail"

---

# Section 2 — Calendar (vue mensuelle)

## 2.1 Bug couleurs des pastilles d'event

**Problème** : les pastilles colorées affichées sur chaque jour ne correspondent pas aux types d'events réels. Exemple observé : 2 pastilles affichées (rouge + orange) alors que les 2 events du jour sont du même type (`Concert`) qui devrait être orange.

**Cause probable** : la couleur des pastilles est mappée sur autre chose que `event.type` (peut-être l'ordre, l'index, le groupe...).

**Fix** :

- Créer une **constante unique** de mapping `EventType` → couleur dans `lib/constants/event-colors.ts`
- Toutes les UI (Calendar, Upcoming, Filters, badges) **doivent lire cette même source**
- Suggested mapping (à valider) :
  - `COMEBACK` → rose vif
  - `MUSIC_SHOW` → bleu
  - `LIVE` → vert
  - `ANNIVERSARY` → jaune
  - `CONCERT` → orange
  - `MV` → rouge
  - `OTHER` → gris

**Critère d'acceptation** : 2 events du même type le même jour → 2 pastilles de la **même couleur**. Au survol/clic, les détails confirment la cohérence couleur ↔ type.

## 2.2 Limite de pastilles par jour

- **Maximum 5 pastilles** affichées dans une case de jour
- Si plus de 5 events ce jour-là, afficher une annotation `+N` (ex: `+8`) à la place des pastilles excédentaires
- Au clic sur le jour : modale/popover qui montre **tous** les events du jour (pas tronqués)

## 2.3 Bug : ronds ne représentent pas tous les types d'events de la journée

**Problème** : exemple cité — le 2 juin, il y a 1 concert + 1 music show + 1 release + 1 MV, mais seulement 2 ronds rouges affichés (qui semblent représenter uniquement les MV).

**Cause probable** : le calcul des pastilles ne fait pas un `groupBy` correct sur tous les types d'events du jour.

**Fix** :

- Pour chaque jour, lister **tous** les events (filtrés selon le filtre Groups actif)
- Grouper par `event.type`
- Afficher **une pastille par type d'event présent** (1 par type, pas 1 par event)
- Trier les pastilles par ordre cohérent (ex: par fréquence d'usage ou par alphabet)
- Appliquer ensuite la limite de 5 (§2.2)

**Critère d'acceptation** : un jour avec 1 concert + 1 music show + 1 release + 1 MV affiche **4 pastilles de 4 couleurs distinctes** (orange, bleu, [release color], rouge).

---

# Section 3 — Bloc Filters (page Calendar)

## 3.1 Filtre "Groups"

Ajouter en **haut** du bloc Filters (au-dessus des filtres par type d'event) :

- **Sélecteur de groupes** (multi-select) avec recherche
- Valeur spéciale `All groups` (tous les groupes, sélection par défaut alternative)
- Boutons d'action :
  - **Reset filtres** : revient à `All groups` + tous les types d'events cochés
  - **My groups** : sélectionne automatiquement les groupes suivis par l'user (depuis `UserFollow`)

## 3.2 Comportement par défaut

- **Si l'user est connecté** : filtre par défaut = ses groupes suivis (équivalent du bouton `My groups`)
- **Si l'user n'est pas connecté ou n'a aucun follow** : filtre par défaut = `All groups`

## 3.3 Persistence

- L'état du filtre Groups est sauvegardé dans **`localStorage`** (clé : `kstage.filter.groups`)
- Persiste après déconnexion / fermeture du navigateur
- Au reload, l'app lit `localStorage` et restaure le filtre
- Si `localStorage` est vide → applique le défaut (§3.2)

---

# Section 4 — Bannières d'events clickables

Sur la page Upcoming, chaque bannière d'event doit être cliquable et renvoyer vers une destination contextuelle selon son type :

| Type d'event  | Destination au clic                                          | Fallback si pas de destination |
| ------------- | ------------------------------------------------------------ | ------------------------------ |
| `COMEBACK`    | Page MV (si MV associé)                                      | Page artiste                   |
| `MUSIC_SHOW`  | Source officielle (YouTube channel du show, Mnet, KBS, etc.) | Page artiste                   |
| `LIVE`        | URL du live (YouTube Premiere, Weverse, etc.)                | Page artiste                   |
| `MV`          | Page MV (`/mv/[id]`)                                         | — (toujours dispo)             |
| `CONCERT`     | URL source (tweet, site officiel de la tournée)              | Page artiste                   |
| `ANNIVERSARY` | Page artiste (`/groups/[slug]`)                              | —                              |
| `OTHER`       | URL source si présente                                       | Page artiste                   |

**Implémentation** :

- Champ `Event.source_url` (déjà dans le schéma) utilisé comme destination quand pertinent
- Champ `Event.related_mv_id` (à ajouter, FK nullable vers `mv`) pour les comebacks liés à un MV publié
- Si la destination est une URL externe : ouvrir dans un nouvel onglet (`target="_blank"` + `rel="noopener noreferrer"`)
- Si interne : navigation Next.js classique

**Critère d'acceptation** : cliquer sur chaque type de bannière sur la page Upcoming amène à la bonne destination, sans 404 ni clic mort.

---

# Section 5 — Page Groups (liste de tous les groupes)

## 5.1 Barre de recherche

- Champ de recherche en haut de la liste
- **Filtrage live à chaque frappe** (lettre par lettre)
- Debounce léger (~100 ms) pour ne pas saturer
- Recherche insensible à la casse, sur `group.name` (et éventuellement `group.aliases` si dispo)
- Animation fluide à l'apparition/disparition des cards (fade ou layout shift smooth)

**Implémentation suggérée** : `useDeferredValue` ou `useMemo` sur la liste filtrée.

---

# Section 6 — Page Artist (page détail d'un groupe ou solo)

## 6.1 Section "Upcoming events"

- Afficher **les 5 prochains events** par défaut
- Si plus de 5 events à venir : bloc **scrollable verticalement** pour voir les autres
- Limite raisonnable (ex: 20 events max chargés, au-delà → lien "See all on Calendar")

## 6.2 Section "Liens externes / réseaux sociaux"

**Séparation visuelle** entre deux groupes de liens :

**Groupe A — Réseaux sociaux** :

- Twitter/X
- Instagram
- TikTok
- YouTube (chaîne officielle)
- Weverse (profil officiel)
- Facebook (si présent, rare)

**Groupe B — Plateformes d'écoute musicale** :

- Spotify
- Apple Music
- YouTube Music
- Deezer
- SoundCloud (si présent)

Layout proposé : 2 rangées distinctes, ou 2 colonnes, ou un séparateur visuel (`<hr>` discret).

## 6.3 Icônes avec couleur de marque

- Chaque icône doit utiliser **la couleur officielle de la marque** :
  - Twitter/X : noir (#000)
  - Instagram : gradient officiel (#E4405F → #FCAF45) ou couleur principale (#E4405F)
  - TikTok : noir + cyan/rose accent
  - YouTube : rouge (#FF0000)
  - Spotify : vert (#1DB954)
  - Apple Music : rose/rouge (#FA2D48)
  - Deezer : violet/rose (#A238FF → #EF5466)
  - Weverse : violet (#7B2CFF)
- Stocker les couleurs dans `lib/constants/brand-colors.ts`
- Au survol : effet subtil (scale, ombre, ou animation de marque)

---

# Section 7 — Layout global (page Upcoming et autres)

## 7.1 Ordre des blocs latéraux

**Inverser l'ordre actuel** : `Recent Comebacks` doit être affiché **au-dessus** de `Recent Activity`.

## 7.2 Refonte du bloc "Recent Activity"

**Problème actuel** : mock data, ne reflète pas la vraie activité.

**Refonte demandée** : retour à un format **forum-like** (comme c'était avant, mais en live) :

- Liste des **articles/pages les plus récemment commentés**
- Format de chaque ligne :
  - Titre de l'article/page commenté (ex: "aespa - Whiplash" pour un MV, ou "Comeback ILLIT" pour un event)
  - Nombre total de commentaires sur cet article
  - Optionnel : timestamp du dernier commentaire (ex: "Last comment 5 min ago")
- **Tri** : antéchronologique sur le **dernier commentaire posté** (pas la date de création de l'article)
- Limite : 10-15 entrées
- **Mise à jour live** via Supabase Realtime (`postgres_changes` sur la table `comment`) ou polling 30s en fallback
- Clic sur une ligne → navigation vers la page commentée

**Critère d'acceptation** : poster un nouveau commentaire sur un MV → le MV remonte en haut de Recent Activity sans reload de page.

---

# Section 8 — Page MV

## 8.1 Bug drag-to-scroll horizontal

**Problème** : la liste des MV dans la section "From your groups" ne se fait pas défiler en cliquant-glissant avec la souris. Seul le scroll wheel / trackpad fonctionne.

**Fix attendu** :

- Implémenter le drag-to-scroll natif :
  - `pointerdown` → mémoriser la position de départ
  - `pointermove` → calculer le delta et appliquer `scrollLeft += delta`
  - `pointerup` / `pointerleave` → fin du drag
- Pendant le drag : `cursor: grabbing`, désactiver la sélection de texte (`user-select: none`)
- Préserver le scroll natif (trackpad / wheel) en parallèle

**Alternative** : utiliser la lib `react-horizontal-scrolling-menu` si l'implé maison est trop coûteuse.

**Critère d'acceptation** : sur desktop, on peut cliquer sur une card de MV, glisser à gauche/droite, et la liste défile. Le clic sans drag (mouvement < 5px) reste un clic normal qui navigue vers le MV.

## 8.2 Amélioration visuelle des cards de MV

Rendre les cards "plus sympa" :

- **Image du groupe / de l'artiste** affichée sur la card (en plus de la thumbnail du MV si pertinent)
- **Nom du groupe** lisible sous ou sur la thumbnail
- Hover effect (scale, glow, ou shift de l'image)
- Layout cohérent avec le reste du design system

---

# Section 9 — Bugs identifiés

## 9.1 Page Artist : section Upcoming events vide

**Symptôme** : la page de aespa (par exemple) affiche "aucun event à venir" alors que des events aespa existent dans l'app (visibles sur Upcoming et Calendar).

**Causes possibles** :

- Query mal filtrée (ex: filtre `group_id` incorrect, mauvais join, RLS policy qui bloque)
- Mauvais format de date dans le filtre `start_at >= now()`
- Données mal liées (events avec `group_id` null ou pointant ailleurs)

**Investigation** :

1. Vérifier la query Supabase utilisée sur la page artiste
2. Vérifier que les events aespa ont bien `group_id = [id de aespa]` en DB
3. Vérifier la policy RLS sur `event` côté lecture
4. Comparer la query avec celle de la page Upcoming (qui marche)

**Critère d'acceptation** : la section "Upcoming events" d'une page artiste affiche tous les events futurs liés à ce groupe, dans l'ordre chronologique.

## 9.2 Header : photo de profil non visible quand connecté

**Symptôme** : user connecté, mais l'avatar n'apparaît pas dans le header (vide ou placeholder par défaut).

**Causes possibles** :

- État d'auth pas hydraté correctement côté client (race condition à l'init)
- Composant Header ne réagit pas au changement de session (manque de subscription `onAuthStateChange`)
- `avatar_url` non remonté dans le user object (pas dans le select Supabase)
- Mauvais path d'image (404)

**Investigation** :

1. Vérifier l'init du provider d'auth côté client (`useEffect` au mount, hydratation SSR)
2. Vérifier que le Header s'abonne à `supabase.auth.onAuthStateChange`
3. Inspecter le user object retourné — `avatar_url` est-il bien là ?
4. Si l'user n'a pas encore d'avatar uploadé : afficher un placeholder cohérent (initiales du username, par exemple)

**Critère d'acceptation** : après login, l'avatar apparaît dans le header en moins de 500 ms, sans reload manuel. Si pas d'avatar uploadé, affichage des initiales sur un fond coloré.

---

# Section 10 — Data : images de groupes/membres datées

**Problème** : les images affichées dans les pages groupe/artiste datent (anciennes ères, vieux logos, membres qui ont quitté, etc.).

**Solutions à explorer** (par ordre de complexité croissante) :

1. **Mise à jour manuelle ponctuelle** : refresh des images pour les 4 groupes MVP (aespa, ILLIT, BABYMONSTER, (G)I-DLE) en récupérant les dernières photos officielles depuis les comptes Twitter/Instagram officiels
2. **Pipeline auto basée sur Spotify** : l'API Spotify (déjà configurée) retourne des images d'artistes mises à jour à chaque comeback. Faire un job hebdomadaire qui rafraîchit `group.image_url` depuis Spotify
3. **Pipeline auto basée sur les comptes officiels** : scraper la dernière photo de profil Twitter/X du compte officiel (méthode plus fragile)

**Reco** : **option 2** (Spotify API), c'est le meilleur ratio fiabilité/effort. À mettre dans le data pipeline (Phase 5 du doc principal).

**Critère d'acceptation** : les images des 4 groupes MVP correspondent à leur ère actuelle (visible sur leurs comptes officiels), et un job de refresh tourne automatiquement.

---

# Récap des conventions de travail

- Toutes les modifications respectent les règles du `CLAUDE.md` (réfléchir avant, simplicité, chirurgical, orienté objectif)
- **Une branche par section** (ex: `feat/section1-auth-polish`, `fix/section9-header-avatar`)
- Commits petits et atomiques
- Avant chaque commit : `npm run lint` + `npm run typecheck` doivent passer
- Tester en local **avant** de pousser ; tester sur Vercel preview **avant** de merger
- Si une section impacte la DB : passer par une migration SQL versionnée (pas de modif directe via le dashboard Supabase)
