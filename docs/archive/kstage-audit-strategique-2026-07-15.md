# KStage

## Audit stratégique, produit, données et expérience utilisateur

**État du projet analysé : 15 juillet 2026**  
**Document partageable - version 1.0**  
**Périmètre : analyse en lecture seule, sans modification du code ni des données**

---

## Résumé exécutif

KStage est une application web mobile-first destinée aux fans internationaux de k-pop. Sa promesse centrale est simple : suivre ses artistes favoris, consulter leurs prochaines sorties et apparitions dans un calendrier personnalisé, puis recevoir des rappels utiles.

Le projet est nettement plus avancé qu'un MVP classique. Il possède déjà :

- un catalogue important d'artistes, de membres et de MVs ;
- une architecture multi-source pour les releases et music shows ;
- un calendrier global et personnalisé ;
- des notifications push et des préférences par type ;
- un feed iCal individuel ;
- une PWA installable ;
- des pages artistes, membres et MVs ;
- des notes, likes et commentaires ;
- une administration des données et des signalements ;
- une base technique sérieuse, testée et sécurisée.

Le verdict général est le suivant :

| Axe | Verdict |
| --- | --- |
| Produit | Proposition de valeur crédible et différenciante |
| Technique | Fondations solides et projet bien au-delà du prototype |
| Scraping | Architecture mature, mais monitoring encore trop passif |
| Données | Catalogue suffisant pour une bêta, quelques brèches de confiance à fermer |
| Design | Identité forte et distinctive, parfois trop dense |
| UX | Parcours complet, activation et mobile encore perfectibles |
| Rétention | Hypothèse prometteuse, mais aucune preuve sans utilisateurs |
| Monétisation | Potentiel réel autour de la personnalisation, trop tôt pour construire le paiement |
| Lancement | Bêta privée crédible après correction des problèmes de confiance prioritaires |

KStage n'a pas besoin de davantage de fonctionnalités pour devenir testable. Il a surtout besoin d'aligner parfaitement sa promesse, ses données, ses notifications et ses mécanismes de mesure.

---

## 1. Clarification : automatisation et temps humain

L'objectif d'un scraper n'est pas de produire une liste que le propriétaire doit relire plusieurs fois par semaine. Une fois qu'un artiste et ses sources sont correctement intégrés, la collecte courante doit fonctionner sans intervention.

Si le même type de faux positif réapparaît régulièrement, ou si une information erronée déclenche une fausse notification, le problème est structurel : le filtre, le matching, la source ou la règle de publication doit être corrigé.

Le temps humain reste utile uniquement sur des exceptions :

- une source externe change sa structure ;
- l'identité d'une nouvelle chaîne YouTube est ambiguë ;
- les MVs d'un nouveau groupe vivent sur la chaîne de son label ;
- un candidat début ne dispose pas de suffisamment de preuves ;
- un signal utilisateur révèle une classe d'erreur encore inconnue.

Ce n'est pas du travail éditorial récurrent. C'est de la maintenance exceptionnelle d'un système dépendant de plateformes externes.

Une nuance reste importante. Avec 168 artistes - groupes et solistes - et environ 2 355 MVs, quelques anomalies indépendantes ne suffisent pas à qualifier toute l'architecture de mauvaise. Il faut mesurer :

- la répétition d'une même classe d'erreur ;
- le taux par rapport au volume ingéré ;
- la gravité de l'erreur ;
- sa capacité à atteindre l'utilisateur ;
- la capacité du système à la bloquer avant une notification.

Une fausse notification est beaucoup plus grave qu'un candidat début laissé en attente ou qu'un nom non matché dans un journal technique.

### Modèle opérationnel cible

```text
Source publique ou API
        |
        v
Fetch + journal technique
        |
        v
Parser -> normalisation -> matching
        |
        v
Gate de confiance
   |                    |
   | confiance forte    | ambiguïté
   v                    v
Publication          Quarantaine / pending
   |
   v
Éligibilité aux notifications

En parallèle : mesures de santé -> anomalie qualifiée -> alerte au propriétaire
Sinon : silence
```

L'objectif raisonnable pour KStage est que trois semaines sur quatre ne demandent aucune action. Lorsqu'une intervention est nécessaire, l'alerte doit déjà fournir la source, l'écart observé, le dernier run validé et l'impact utilisateur possible.

---

## 2. Comprendre KStage comme produit

### 2.1 Proposition de valeur

Le cœur de KStage est une boucle utilitaire :

1. l'utilisateur trouve ses artistes ;
2. il les suit ;
3. KStage filtre le calendrier ;
4. une release ou un music show approche ;
5. l'utilisateur reçoit une alerte ou consulte son flux ;
6. il revient dans l'application.

Cette boucle est pertinente parce qu'elle résout un vrai problème du fandom : les annonces sont dispersées entre YouTube, sites de diffuseurs, trackers communautaires et réseaux sociaux, souvent publiées en KST et à des horizons différents.

Le positionnement le plus fort est celui d'un calendrier personnel fiable, et non celui d'une encyclopédie exhaustive.

Une formulation possible serait :

> A reliable personal K-pop schedule. Follow your artists, see upcoming releases and music shows in your timezone, and control the alerts you receive.

### 2.2 Produit principal et produit secondaire

Le calendrier, le suivi des artistes, les notifications et le flux iCal constituent le produit principal.

Les notes, likes et commentaires constituent un produit secondaire prometteur. Ils peuvent augmenter l'engagement lorsque l'audience existe, mais ne doivent pas devenir la promesse dominante avant que des utilisateurs soient présents.

La landing emploie actuellement une comparaison avec "The Letterboxd of K-pop". L'idée est intéressante à long terme, mais elle peut brouiller la proposition de valeur. La donnée et le calendrier doivent vendre KStage ; la communauté doit enrichir l'expérience.

### 2.3 Public cible

Le choix d'un lancement international anglophone est cohérent :

- l'anglais est largement utilisé dans le fandom international ;
- le produit couvre des utilisateurs situés dans plusieurs fuseaux ;
- les sources et titres officiels utilisent souvent l'anglais ;
- traduire trop tôt disperserait l'effort sans preuve de demande.

Le français et l'espagnol doivent être envisagés plus tard, selon les pays, langues de navigateur, recherches et demandes réellement observés.

La timezone, en revanche, n'est pas une traduction facultative. C'est une exigence de lancement international.

---

## 3. Périmètre fonctionnel recommandé

### 3.1 Types à conserver

Le recentrage sur les catégories suivantes est pertinent :

- MVs ;
- releases ;
- music shows ;
- anniversaires de début de carrière et anniversaires des artistes.

Ces quatre catégories forment un ensemble cohérent, fréquent et suffisamment automatisable.

### 3.2 Lives et concerts

Les lives et concerts représentent presque un produit séparé :

- annonces distribuées sur de nombreuses plateformes ;
- disponibilité très variable selon les agences ;
- annulations et modifications ;
- lieux, villes et fuseaux ;
- tours multi-dates ;
- informations souvent publiées uniquement sur les réseaux sociaux.

Ils doivent donc être retirés de la promesse publique actuelle. Ils peuvent rester dans les enums internes pour compatibilité historique, mais les utilisateurs ne doivent pas attendre une couverture qui n'est pas assurée.

### 3.3 Risque de dispersion

Le produit comporte déjà de nombreuses surfaces : landing, home personnalisée, calendrier, recherche, groupes, artistes, MVs, profils, commentaires, notes, notifications, iCal, suggestions, feedback et administration.

Le risque n'est plus d'être trop petit. Le risque est de diluer l'effort entre :

- la fiabilité du calendrier ;
- les fonctionnalités sociales ;
- l'expansion du catalogue ;
- la traduction ;
- la monétisation ;
- de nouveaux types d'événements.

Le cœur calendrier doit être stabilisé avant toute nouvelle verticale.

---

## 4. Stratégie de couverture des artistes

Le choix ne doit pas être limité à "seulement les grands groupes" ou "absolument toute la k-pop".

La stratégie recommandée est :

> Catalogue large, niveau de garantie gradué.

### 4.1 Trois niveaux de couverture

| Niveau | Définition | Publication | Notifications |
| --- | --- | --- | --- |
| Vérifié | Identité et sources confirmées, scraping récent | Oui | Oui |
| Surveillé | Artiste légitime, couverture potentiellement partielle | Oui, avec promesse limitée | Seulement données à forte confiance |
| Candidat / pré-début | Détection automatique encore ambiguë | Non ou noindex | Non |

Ces niveaux peuvent d'abord rester internes. Ils permettent de distinguer la largeur du répertoire et la garantie du scheduler.

### 4.2 Grands groupes et longue traîne

Les grands groupes servent :

- l'acquisition ;
- la crédibilité ;
- la preuve visuelle ;
- les recherches SEO à fort volume.

Les groupes émergents et moins couverts servent :

- la différenciation ;
- la fidélité de niches mal servies ;
- l'acquisition sur des requêtes moins concurrentielles ;
- la construction d'une relation dès le début d'un fandom.

Ajouter rapidement les nouveaux débuts est donc une bonne intuition, à condition que l'auto-publication soit réservée aux cas disposant de preuves fortes.

### 4.3 État actuel suffisant

L'état documenté au 14 juillet 2026 annonce :

- 168 groupes et solistes ;
- environ 2 355 MVs ;
- 864 membres ;
- aucune page groupe identifiée comme totalement vide lors de la vérification du 14 juillet ;
- 544 tests unitaires et 28 E2E.

Du seul point de vue de la couverture, ce catalogue est suffisant pour commencer une bêta. Le lancement reste toutefois conditionné par la fermeture des brèches de confiance prioritaires. Attendre davantage de groupes ne donnera aucune information supplémentaire sur l'activation ou la rétention.

### 4.4 File de débuts

Le pipeline de débuts détecte automatiquement de nouveaux candidats, crée automatiquement ceux qui franchissent un seuil de confiance et place les autres en attente.

Cette file ne doit pas devenir une liste de travail obligatoire. Les candidats ambigus peuvent rester en attente jusqu'à ce qu'un signal les priorise :

- recherche utilisateur sans résultat ;
- demande explicite ;
- nouvelle source officielle ;
- seuil d'audience franchi ;
- apparition dans une source reconnue.

---

## 5. Architecture et méthode de récupération des données

### 5.1 Vue d'ensemble

KStage utilise une architecture hybride :

- API officielles lorsque disponibles ;
- scraping de pages publiques ;
- sources éditorialement indépendantes, mais parfois dépendantes d'un même transport ;
- données statiques pour les anniversaires ;
- suggestions et feedback comme filet communautaire ;
- administration pour les corrections exceptionnelles.

Chaque source est isolée dans son propre module. C'est une bonne décision : une modification de markup peut être corrigée sans réécrire tout le pipeline.

### 5.2 MVs

La collecte MV repose sur YouTube Data API et les playlists d'uploads de chaînes officielles ou de labels.

Points forts :

- utilisation de `playlistItems.list`, adaptée au quota ;
- concurrence bornée entre les sources ;
- arrêt propre lorsque le quota est dépassé ;
- détection des premières programmées ;
- filtres contre teasers, reactions, behind, practices et autres dérivés ;
- vérification de la durée minimale ;
- matching sur le titre ;
- déduplication cross-chaînes, avec conservation du premier doublon rencontré plutôt qu'une sélection explicite de la meilleure source ;
- modèle de classification des versions (`main`, `member`, `performance`, `other_version`), avec une tension actuelle entre cette classification et le gate strict qui rejette certains titres contenant "performance".

Limites :

- certaines playlists `uploads` sont incomplètes ;
- les catalogues anciens sur de grandes chaînes de labels demandent un backfill profond ;
- une nouvelle chaîne de label n'est pas toujours découverte automatiquement ;
- les noms courts ou les renommages peuvent rendre le matching ambigu.

### 5.3 Releases

Les releases futures proviennent principalement de kpopofficial, avec Wikipedia comme source secondaire présentant un mode de défaillance différent.

Points forts :

- deux sources éditorialement indépendantes ;
- cœur d'ingestion partagé ;
- matching commun ;
- déduplication cross-source dans une fenêtre de plusieurs jours ;
- statuts `confirmed` ou `tentative` selon la précision de l'heure.

Limites :

- Wikipedia n'est pas exhaustif sur les singles et MVs ;
- une annonce sans heure est stockée avec une heure technique ;
- la déduplication privilégie le premier événement au lieu de fusionner les informations les plus précises ;
- kpopofficial reste la source principale de la majorité du futur.

### 5.4 Music shows

Le pipeline music shows est plus robuste qu'un scraper simple :

- source primaire communautaire structurée ;
- six fallbacks provenant des diffuseurs, de qualité temporelle inégale : certains confirment surtout l'épisode courant ou récent plutôt qu'une lineup future ;
- fallback lorsqu'une lineup est absente ou trop maigre ;
- correction automatique d'un changement d'heure ;
- suppression des doublons historiques ;
- réconciliation des groupes retirés d'une lineup future ;
- slots synthétiques "Lineup TBA" ;
- recherche de liens YouTube vers les stages après diffusion ;
- signal J-1 journalisé lorsqu'un show proche n'a aucune donnée.

Limites :

- les lineups sont publiées tardivement, souvent la veille ou quelques jours avant ;
- aucune source ne permet un calendrier détaillé plusieurs semaines à l'avance ;
- les sources utilisent encore un transport commun via Jina, qui reste un point de défaillance ;
- l'événement ne conserve pas toujours la provenance exacte du fallback ;
- l'enrichissement des stage links est best-effort et peut échouer sans dégrader le statut global.

La faible profondeur temporelle n'est pas un bug du parser. Le scraper ne peut pas inventer une lineup que le diffuseur n'a pas encore publiée.

### 5.5 Anniversaires

Les anniversaires sont générés depuis les dates des groupes et des membres. C'est une approche simple, déterministe et très peu coûteuse.

Les risques concernent principalement :

- la qualité de la date source ;
- les homonymes et profils canoniques ;
- le wording de l'âge ou de l'anniversaire ;
- le traitement all-day selon les fuseaux occidentaux.

Pour les anniversaires, le flux iCal gère correctement les événements couvrant toute la journée selon la date KST. Cela ne corrige pas la fuite distincte des événements `hidden` dans le flux.

---

## 6. Évaluation du scraping et de l'observabilité

### 6.1 Ce qui est solide

KStage possède déjà :

- un contrat commun `ok / partial / error` ;
- un journal structuré `scrape_log` ;
- les compteurs et erreurs par source ;
- des HTTP 500 lorsque le run est totalement inexploitable ;
- un `last_scraped_at` protégé contre les échecs totaux de fetch, mais qui ne garantit pas toujours qu'une entrée utile a été parsée ;
- des tests sur fixtures réelles ;
- des fallbacks ;
- des contraintes d'idempotence ;
- des mécanismes d'auto-réconciliation ;
- un workflow GitHub Actions avec sept horaires et un déclenchement manuel.

Cette architecture démontre que le scraping n'est pas mauvais de base.

### 6.2 Ce qui reste trop passif

GitHub Actions juge essentiellement le code HTTP. Un `partial` retourne généralement 200 et laisse le run vert.

Cela peut masquer :

- une partie des sources YouTube en erreur ;
- la source music show principale en panne avec fallback actif ;
- un signal J-1 sans lineup ;
- une page récupérée mais zéro entrée parsée ;
- Fandom bloqué alors que les releases fonctionnent encore ;
- une erreur de fallback music show qui ne dégrade pas le statut lorsque la source primaire a répondu et qu'aucun signal J-1 n'est présent.

Les échecs totaux sont visibles dans GitHub Actions, mais les états `partial` et les anomalies métier n'alimentent ni interface in-app ni canal d'alerte dédié.

### 6.3 Contrat d'alerte recommandé

| Situation | Réponse attendue |
| --- | --- |
| Fetch et parsing normaux, zéro insertion | Silence |
| Fallback utilisé une fois | Journal seulement |
| `partial` deux runs consécutifs | Alerte qualifiée |
| Music show à J-1 sans données | Alerte immédiate |
| Source critique périmée deux cycles | Alerte |
| Échec total | Retry borné puis alerte immédiate |
| Matching ambigu | Quarantaine |
| Échec de l'écriture du monitoring | Alerte séparée |

### 6.4 Indicateurs techniques utiles

Pour chaque famille de source :

- heure du dernier run ;
- heure du dernier run validé ;
- nombre de pages ou lineups récupérées ;
- nombre d'entrées parsées ;
- taux de matching ;
- nombre d'inserts, updates et skips ;
- nombre d'unmatched ;
- évolution par rapport à une baseline récente ;
- durée du run ;
- provenance des fallbacks ;
- impact utilisateur potentiel.

Une alerte utile doit expliquer ce qui a changé, et non seulement afficher "cron failed".

---

## 7. Brèches de confiance prioritaires

### 7.1 Fuseau horaire incohérent

La home lit `profiles.timezone`, mais retombe sur `Asia/Seoul`. L'écran Account ne permet pas actuellement d'enregistrer cette timezone.

En parallèle :

- certaines heures utilisent le fuseau du navigateur ;
- certains D-day utilisent le profil ou KST ;
- les labels push "Today" et "Tomorrow" sont calculés en KST pour tous ;
- le digest part à une heure UTC unique ;
- la landing promet "in your timezone".

Le produit affiche parfois la bonne heure locale, mais la logique n'est pas cohérente de bout en bout. C'est un blocage pour un lancement international.

### 7.2 État des notifications trompeur

Le CTA "Notify me" suit principalement le groupe. Une fois le follow actif, l'interface affiche "Notify is on" sans vérifier :

- l'existence d'un abonnement push ;
- la permission navigateur ;
- l'état de l'endpoint ;
- la préférence du type d'événement.

Le texte doit représenter l'état réel, ou distinguer "Following" et "Notifications enabled".

### 7.3 Pression de notifications

Un même comeback peut produire :

- une notification d'annonce ;
- une notification J-1 ;
- une notification le jour J ;
- un digest quotidien les autres jours, ou le digest hebdomadaire qui le remplace le lundi.

Les tags remplacent correctement les rappels successifs d'un même événement dans le tiroir système, mais le volume global peut être excessif pour un utilisateur suivant de nombreux groupes.

La prochaine décision doit porter sur les defaults et le budget de notifications, pas sur l'ajout de nouveaux rappels.

### 7.4 Événements masqués encore visibles

Le champ `hidden` est utilisé dans plusieurs requêtes d'affichage, mais pas partout.

Un événement masqué peut encore atteindre :

- les push comeback ;
- les digests ;
- le feed iCal ;
- le sitemap ;
- une page MV appelée directement ;
- certains compteurs et classements.

C'est une faille importante du contrat de confiance : masquer une fausse donnée dans l'administration ne garantit pas encore qu'elle disparaisse de toutes les surfaces.

### 7.5 Dates incertaines présentées comme exactes

Les releases sans heure et les slots TBA sont marqués `tentative`, mais certaines lignes affichent quand même :

- un D-day exact ;
- une heure locale ;
- une heure KST ;
- parfois un countdown.

Une date connue sans heure devrait être affichée comme "Date confirmed - time TBA" et ne jamais déclencher une alerte minute-précise.

### 7.6 Fraîcheur globale trompeuse

Le statut de la landing utilise le timestamp maximal de toutes les sources. Une seule source fraîche peut masquer plusieurs sources périmées.

La fraîcheur doit être mesurée par famille, selon son rythme attendu : YouTube quotidien, comebacks quotidien, music shows deux fois par jour, images selon leur propre cadence.

---

## 8. Design et expérience utilisateur

### 8.1 Direction visuelle

La direction "Data Desk" est l'une des forces du projet :

- identité sombre et sérieuse ;
- différenciation face aux interfaces pastel du secteur ;
- densité cohérente avec un produit de données ;
- excellente compatibilité avec calendrier, queue, ticker et classements ;
- impression d'un outil vivant plutôt que d'un simple blog.

Le design ne doit pas être refait. Il doit être simplifié et consolidé.

### 8.2 Complexité du système visuel

L'audit statique relève :

- six familles typographiques ;
- environ dix-sept niveaux de taille visibles ;
- de nombreux alias couleur ;
- des micro-labels descendant à 7,5-10 px ;
- une échelle d'espacement très fine.

Cette richesse donne du caractère, mais augmente la charge cognitive et rend la cohérence plus difficile à maintenir.

### 8.3 Landing

La landing présente de vraies données, un countdown et des artistes connus. C'est mieux qu'une landing générique.

Cependant, le premier CTA d'inscription arrive après :

- le hero ;
- la preuve live ;
- le countdown ;
- le mur d'artistes ;
- la barre de preuves ;
- les trois étapes.

Sur mobile, il se situe plusieurs écrans sous la ligne de flottaison initiale.

L'ordre recommandé est : promesse, preuve courte, CTA, puis exploration détaillée.

Le libellé "Happening on KStage right now" est également trompeur : le bloc affiche le prochain événement futur, pas nécessairement un événement en cours.

### 8.4 Home personnalisée

Points positifs :

- bandeau explicite lorsque l'utilisateur n'a aucun follow ;
- prochain drop ;
- queue ;
- vue de la semaine ;
- derniers MVs ;
- contenus communautaires masqués lorsqu'ils sont trop rares.

Points à clarifier :

- Fresh Drops mélange suivi et global sans toujours le signaler ;
- les fallbacks changent lorsqu'un utilisateur suit un ou deux groupes ;
- la personnalisation secondaire arrive après la colonne centrale sur mobile ;
- la home connectée n'a pas de `h1`.

### 8.5 Mobile

Principales frictions :

- recherche très comprimée dans le header visiteur ;
- filtres de calendrier placés après le calendrier dans l'ordre mobile ;
- barre de navigation inférieure visuellement fixe, mais tardive dans l'ordre clavier ;
- certains contrôles inférieurs à 44 px ;
- CTA de landing trop bas ;
- quantité importante de contenu avant les actions de personnalisation.

### 8.6 Accessibilité

Constats principaux :

- absence de skip-link ;
- panels non reliés à de vrais headings ;
- aucun `h1` sur la home connectée ;
- focus visible non uniforme ;
- répétitions du ticker pour les lecteurs d'écran ;
- contrastes limités dans le thème clair ;
- reduced motion incomplet pour les skeletons ;
- histogramme de notes peu accessible.

Il s'agit d'une passe de finition, pas d'une reconstruction.

### 8.7 Classements et sémantique sociale

"Trending" mesure la proximité d'un événement ou la récence d'une sortie, et non une tendance d'audience.

"Top Rated" autorise un MV noté une seule fois à apparaître premier. Le nombre de votes n'est pas toujours visible dans le classement.

Sans utilisateurs, ces surfaces peuvent surinterpréter des signaux faibles. Options :

- renommer Trending en "Active now" ou "In the spotlight" ;
- afficher le nombre de ratings ;
- imposer un seuil minimum ;
- utiliser une moyenne bayésienne lorsque le volume justifie la complexité.

---

## 9. Structure technique, qualité et sécurité

### 9.1 Points forts

Le projet possède :

- Next.js 16 et React 19 ;
- TypeScript strict ;
- composants par domaine ;
- logique métier séparée ;
- Supabase Auth et RLS ;
- rate limits atomiques ;
- CSP ;
- routes cron protégées ;
- service role conservé côté serveur ;
- PWA push ;
- tests unitaires et E2E ;
- administration et modération ;
- documentation historique riche.

Le socle de sécurité est nettement plus mature que celui de nombreux projets sans utilisateurs.

### 9.2 Reproductibilité de la base

La migration 0033 remplace `UNIQUE(url)` par `UNIQUE(url, group_id)`, alors que le seed utilise encore `ON CONFLICT (url)`. Remplacer simplement la clause par `ON CONFLICT(url, group_id)` ne suffirait pas pour les sources dont `group_id` vaut `NULL` : leur unicité nécessite une stratégie explicite.

Autres limites :

- le seed ne représente qu'une petite partie du catalogue ;
- la row de source Wikipedia n'est créée ni par les migrations ni par le seed versionné ; une base fraîche désactive donc ce fallback silencieusement ;
- certaines migrations de contenu utilisent des UUID de production ;
- la couverture dépend de scripts exécutés directement contre la production ;
- la CI ne reconstruit pas une base Supabase fraîche.

Une base fraîche n'est donc pas aujourd'hui une reproduction fiable de l'environnement attendu.

### 9.3 E2E

Le job E2E existe, mais il est désactivé tant que `E2E_ENABLED` et les credentials du repository ne sont pas configurés. Les tests authentifiés locaux utilisent encore le compte personnel du développeur.

Un compte dédié est nécessaire avant l'activation en CI, afin d'éviter qu'un golden path ne modifie :

- les follows réels ;
- les préférences de notifications ;
- le profil ;
- les données communautaires personnelles.

### 9.4 Documentation

La documentation est exceptionnellement riche mais connaît une dérive :

- certaines sections de SCRAPING décrivent encore Vercel Cron ;
- des passages parlent de l'ancien usage de `source_url` au lieu de `stage_url` ;
- README et About promettent encore les lives ;
- About mentionne un bouton Suggest remplacé par Feedback ;
- les chiffres les plus fiables sont surtout dans PROJECT et JOURNAL.

Une hiérarchie stricte est recommandée :

1. état courant ;
2. architecture courante ;
3. roadmap ;
4. historique archivé.

---

## 10. Analytics et rétention

### 10.1 Problème actuel

Vercel Analytics mesure les visites, mais KStage n'enregistre pas d'événements produit explicites.

Il est donc difficile de savoir :

- combien de visiteurs commencent et terminent l'inscription ;
- combien trouvent leurs artistes ;
- combien suivent plusieurs groupes ;
- combien obtiennent un calendrier réellement personnalisé ;
- combien acceptent ou refusent le push ;
- combien reviennent après une notification ;
- combien activent iCal ;
- quelles recherches ne donnent aucun résultat ;
- où se situent les abandons.

### 10.2 North star

Le nombre de comptes ou de groupes en base ne mesure pas la valeur.

Une north star plus pertinente serait :

> Utilisateurs actifs qui consultent ou ouvrent leur calendrier personnalisé chaque semaine.

### 10.3 Événements à instrumenter

- clic sur le CTA de la landing ;
- inscription commencée ;
- inscription terminée ;
- onboarding commencé ;
- premier groupe suivi ;
- trois groupes suivis ;
- calendrier personnalisé contenant un futur événement ;
- prompt push affiché ;
- permission push acceptée, refusée ou indisponible ;
- notification envoyée ;
- notification ouverte ;
- type de notification désactivé ;
- flux iCal activé ;
- recherche sans résultat ;
- suggestion ou feedback envoyé ;
- retour autonome sur le calendrier.

### 10.4 Bêta recommandée

Après fermeture des problèmes de confiance prioritaires :

- 20 à 50 testeurs ;
- trois à quatre semaines ;
- plusieurs fuseaux ;
- fans mainstream et long tail ;
- aucune nouvelle feature communautaire majeure pendant la mesure.

Hypothèses de départ :

| Indicateur | Hypothèse initiale |
| --- | --- |
| Trouve au moins trois artistes | 70 % ou plus |
| Obtient un calendrier personnalisé avec un futur événement | 60 % ou plus |
| Accepte le push | 30 % ou plus |
| Revient pendant la deuxième semaine sans rappel humain | 25 % ou plus des utilisateurs actifs |
| Faux push | 0 |
| Événement masqué exposé | 0 |

Ces seuils sont des hypothèses de travail, pas des standards universels. Avec une petite cohorte, les entretiens et observations qualitatives restent indispensables.

---

## 11. Monétisation

### 11.1 Principe

La monétisation doit porter sur le contrôle et la personnalisation, jamais sur la fiabilité de base.

### 11.2 Gratuit

- calendrier principal ;
- follows ;
- timezone correcte ;
- recherche ;
- notifications de base ;
- préférences par type ;
- un feed iCal ;
- correction et qualité des données.

### 11.3 Premium potentiel

- horaires de rappel personnalisés ;
- plusieurs rappels par événement ;
- règles différentes par groupe ;
- digests configurables ;
- plusieurs flux iCal filtrés ;
- calendriers thématiques ou partageables ;
- filtres et historique avancés ;
- préférences de présentation plus poussées.

### 11.4 Conditions avant paiement

Avant de construire un abonnement :

- observer une rétention réelle ;
- recevoir des demandes spontanées pour des réglages avancés ;
- tester l'intérêt et le prix ;
- unifier le domaine canonique ;
- mettre à jour Terms, About et Privacy ;
- quitter l'hébergement limité à un usage non commercial ;
- définir support, remboursement, suppression de compte et facturation.

Stripe ne doit pas être construit uniquement parce que le schéma contient déjà un futur tier.

---

## 12. Roadmap recommandée

### Phase 0 - Vérité produit et référence documentaire

Objectif : faire correspondre chaque promesse publique à un comportement réel.

Actions :

- officialiser les quatre types couverts ;
- retirer lives et concerts des claims ;
- définir date exacte, date seule, heure TBA et tentative ;
- choisir le document source de vérité ;
- choisir le domaine canonique ;
- définir les règles de publication et de notification par confiance.

Preuve de sortie : aucune page ne promet une fonctionnalité non couverte.

Garde-fou : ne pas ajouter de nouvelle feature pendant cet alignement.

### Phase 1 - Contrat de confiance

Objectif : garantir que ce que l'utilisateur voit et reçoit est cohérent.

Actions :

- timezone de bout en bout ;
- CTA notification fondé sur l'état réel ;
- filtre `hidden=false` central ;
- présentation correcte des dates sans heure ;
- defaults de notifications plus sobres ;
- idempotence des digests ;
- comptage des échecs push ;
- monitoring actif ;
- fraîcheur par famille ;
- retry borné.

Preuves de sortie :

- tests Europe/Paris, America/New_York, Asia/Seoul et Australia/Sydney ;
- aucun événement masqué sur une surface ;
- aucune heure fictive pour un événement tentative ;
- error et partial répétés déclenchent les alertes attendues ;
- zéro faux push observé sur les fixtures et les scénarios de contrôle ; aucune classe connue de faux événement éligible au push.

Garde-fou : aucune revue manuelle systématique.

### Phase 2 - Activation et simplification UX

Objectif : permettre à un nouveau visiteur de comprendre et personnaliser KStage rapidement.

Actions :

- CTA dans le premier écran ;
- landing recentrée sur le calendrier ;
- parcours trouver trois artistes puis voir son calendrier ;
- ordre mobile corrigé ;
- recherche mobile plus lisible ;
- fallbacks globaux explicites ;
- labels Trending, Top Rated et Happening corrigés ;
- nombre de votes visible ;
- passe d'accessibilité ;
- simplification typographique ;
- mesure performance actuelle ;
- analytics produit.

Preuve de sortie : un testeur atteint un calendrier personnalisé sans explication en moins de deux minutes.

Garde-fou : améliorer la hiérarchie existante, pas refaire le design.

### Phase 3 - Couverture large autonome

Objectif : augmenter la couverture sans transformer le catalogue en travail éditorial.

Actions :

- niveaux Vérifié, Surveillé et Candidat ;
- découverte automatique des chaînes de labels ;
- score de confiance et quarantaine ;
- enrichissement automatique des groupes récents pauvres en MVs ;
- provenance exacte des fallbacks ;
- fusion des annonces plus précises ;
- création transactionnelle ou récupérable d'un nouvel artiste ;
- réduction du SPOF Jina ;
- fallback cible pour playlists YouTube incomplètes ;
- base fraîche reproductible ;
- reset DB testé en CI.

Preuve de sortie : un candidat fiable passe de la détection à la publication de ses premiers MVs sans intervention, tandis qu'un cas ambigu ne peut ni être publié ni déclencher de notification.

Garde-fou : ne jamais publier une identité ambiguë pour augmenter le compteur.

### Phase 4 - Bêta rétention

Objectif : vérifier que la boucle follow, calendrier, notification et retour fonctionne avec de vrais utilisateurs.

Actions :

- cohorte de 20 à 50 testeurs ;
- trois à quatre semaines ;
- suivi des événements d'activation ;
- entretiens courts ;
- correction des frictions récurrentes ;
- comparaison mainstream et long tail.

Preuve de sortie : une part significative des utilisateurs actifs revient sans sollicitation humaine, sans faux push observé sur la cohorte bêta.

Garde-fou : ne pas répondre à chaque commentaire par une nouvelle feature.

### Phase 5 - Acquisition et monétisation

Objectif : transformer une utilité qui fidélise en produit durable.

Actions :

- SEO centré sur les schedules et comeback ;
- pages de nouveaux artistes fiables ;
- priorisation des recherches sans résultat ;
- validation des réglages premium ;
- mise à jour juridique et infrastructure ;
- traduction selon les données réelles.

Preuve de sortie : des utilisateurs récurrents demandent spontanement plus de contrôle et acceptent une offre qui ne dégrade pas l'offre gratuite.

Garde-fou : ne jamais monnayer la correction, la timezone ou la fiabilité.

---

## 13. Critères avant bêta

KStage peut entrer en bêta privée lorsque :

- le périmètre public ne promet plus les lives ou concerts ;
- la timezone est cohérente sur l'app et les push ;
- "Notify is on" représente un état réel ;
- `hidden` est respecté partout ;
- les dates sans heure ne présentent plus une précision fictive ;
- les erreurs totales et partials répétés alertent automatiquement ;
- les principaux événements produit sont mesurés ;
- un compte E2E dédié existe ;
- aucune anomalie connue ne peut produire de faux push.

La bêta ne doit pas attendre :

- davantage de groupes ;
- le français ou l'espagnol ;
- une nouvelle refonte ;
- davantage de fonctions sociales ;
- une offre payante.

---

## 14. Ce qu'il ne faut pas faire maintenant

- Réintroduire les lives ou concerts.
- Traduire toute l'application.
- Vider manuellement toute la file de débuts.
- Ajouter des centaines de groupes sans niveau de confiance.
- Construire un forum.
- Refaire le design de zéro.
- Développer Stripe avant la bêta.
- Imposer une vérification manuelle hebdomadaire de chaque source.
- Confondre nombre de pages et valeur utilisateur.
- Confondre absence d'insertion et panne de scraper.

---

## 15. Conclusion

KStage ne doit pas transformer son propriétaire en rédacteur en chef permanent. Son scraping contient déjà beaucoup de mécanismes matures : sources isolées, fallbacks, déduplication, fixtures, logs, gates et auto-réconciliation.

Le travail restant consiste principalement à :

- transformer le monitoring passif en alertes rares ;
- isoler les cas ambigus avant publication ;
- aligner timezone et notifications ;
- garantir qu'un événement masqué disparaît partout ;
- rendre l'incertitude des dates visible ;
- mesurer l'activation et la rétention ;
- tester le produit avec une petite audience internationale.

L'intuition de couvrir les nouveaux groupes est bonne. La stratégie gagnante n'est pas de promettre toute la k-pop au même niveau, mais de découvrir largement et de garantir uniquement ce qui est vérifié.

Le principal frein au lancement n'est plus le volume du catalogue. C'est la fermeture de quelques brèches de confiance, puis l'observation de vrais utilisateurs.

---

## Annexe A - Sources principales consultées

### Documentation produit et opérationnelle

- `README.md`
- `docs/README.md`
- `docs/PROJECT.md`
- `docs/KSTAGE_BRIEF.md`
- `docs/SCRAPING.md`
- `docs/RISKS.md`
- `docs/BACKLOG.md`
- `docs/JOURNAL.md`
- `docs/AUDIT_PROJET_2026-06-12.md`
- `docs/AUDIT_UX_2026-06.md`
- `docs/PERFORMANCE_AUDIT.md`
- `docs/SECURITY_AUDIT.md`

### Scraping et crons

- `.github/workflows/crons.yml`
- `.github/workflows/ci.yml`
- `src/app/api/cron/*`
- `src/lib/scrapers/youtube.ts`
- `src/lib/scrapers/kpopofficial.ts`
- `src/lib/scrapers/wikipedia-releases.ts`
- `src/lib/scrapers/comeback-ingest.ts`
- `src/lib/scrapers/scrape-log.ts`
- `src/lib/scrapers/music-shows/*`
- `src/lib/scrapers/debuts/*`

### Produit et expérience

- `src/app/(home)/page.tsx`
- `src/components/landing.tsx`
- `src/components/events/queue-row.tsx`
- `src/components/home/*`
- `src/components/notifications/*`
- `src/app/calendar/page.tsx`
- `src/app/groups/*`
- `src/app/mvs/*`
- `src/app/mv/[slug]/page.tsx`
- `src/app/account/page.tsx`

### Données et infrastructure

- `supabase/migrations/*`
- `supabase/seed.sql`
- `src/types/database.ts`
- `src/lib/events/*`
- `src/lib/notifications/*`
- `src/lib/ical/*`

---

## Annexe B - Méthode et limites

L'analyse combine :

- lecture du code et des migrations ;
- lecture de la documentation active et historique ;
- inspection des flux frontend ;
- analyse de l'architecture de scraping ;
- vérification des workflows CI et crons ;
- constats visuels statiques sur l'adaptation responsive ;
- observations de production déjà effectuées pendant l'audit principal.

Limites :

- aucune audience n'existe encore ;
- la rétention ne peut donc pas être mesurée ;
- aucune mutation de production ni reset destructif n'a été effectuée ;
- la stabilité future des sources tierces ne peut pas être garantie ;
- certaines estimations de performance provenaient d'un build légèrement antérieur au dernier fichier de page.

Le document distingue les faits observés, les risques probables et les recommandations produit. Il ne constitue pas une promesse de performance ou de couverture future.
