# KStage — Audit UX/Design & Benchmark (2026-06)

> North-star : **rétention**. Les 4 axes (design, modernité, navigation, rétention) sont analysés, mais les priorités pèsent d'abord l'impact sur « revenir / suivre / s'engager ».
> Méthode : captures réelles desktop+mobile (connecté/déconnecté, `.audit/`), + benchmark vérifié vivant (concurrents k-pop directs + best-in-class hors k-pop). Tout finding est adossé à une preuve terrain ou concurrente.

---

## 1. Synthèse exécutive

**KStage est techniquement au-dessus du marché k-pop** (PWA propre, dark soigné, follow + calendrier + comptes natifs), avec **un différenciateur unique** que personne n'occupe vraiment : **les notes 1–10 par MV + commentaires** (un « Letterboxd du k-pop »). Le design est cohérent et sérieux.

**Mais le produit ne donne pas encore de raison forte de revenir.** Le risque n°1 d'un calendrier — le **vide** (J0 et returning) — est partout : groupes suivis sans event à venir, 0 commentaire, 0 discussion, centre de la home sparse. Et les hooks de rétention que les concurrents exploitent (countdowns, push datés par comeback, feed perso, preuve sociale, rétro annuelle) sont **absents ou sous-exploités**, alors que l'infra (push VAPID, ratings) est **déjà là**.

### 3 paris majeurs (par ordre de ROI rétention)

1. **Tuer le vide & activer dès la 1ʳᵉ minute** — onboarding « follow d'abord » (pré-sélection des groupes populaires) + états vides qui proposent une action, pour qu'aucun écran ne soit mort.
2. **Transformer le push (déjà en prod) en hook daté** — « comeback de [ton groupe] aujourd'hui / J-1 » + digest hebdo. C'est le déclencheur de retour le plus direct, à effort faible.
3. **Capitaliser sur le différenciateur communautaire** — like léger découplé de la note, feed d'activité, profil-vitrine de stats → faire de KStage _le lieu où on note/discute les comebacks_, pas juste un calendrier qu'on consulte.

---

## 2. Scorecard (1–5)

| Dimension              | Actuel  | Cible | Commentaire                                                                                                                        |
| ---------------------- | :-----: | :---: | ---------------------------------------------------------------------------------------------------------------------------------- |
| Design / esthétique    | **3.5** |  4.5  | Dark cohérent et propre, bon design system ; mais sparse, peu d'imagerie sur les surfaces clés, micro-interactions limitées.       |
| Modernité              | **3.5** |  4.5  | Stack 2026, PWA, dark-first = au niveau de _blip_, au-dessus de _kpopping/kprofiles_. Manque le « wow » (motion, data-viz, perso). |
| Navigation / usabilité | **3.0** |  4.5  | Claire en desktop ; **nav mobile non persistante** (inline qui défile), landing = mur de noms, findabilité moyenne.                |
| **Rétention**          | **2.5** |  4.5  | **Point faible** : états vides, pas de hook de retour actif, différenciateur ratings froid/sous-exploité, zéro preuve sociale.     |
| Accessibilité          | **4.0** |  4.5  | Culture a11y présente (lint jsx-a11y, focus states) ; à confirmer au clavier/SR.                                                   |
| SEO / acquisition      | **3.0** |  4.0  | Non audité en profondeur ; la rétention dépend d'abord de l'acquisition (landing + pages publiques indexables).                    |

---

## 3. Findings par dimension (avec preuves)

### A. Design / esthétique

- **A1 — Home connectée trop sparse (centre sous-utilisé).** _Preuve : `08-home-in-d`._ Le centre = un seul gros countdown (souvent un **anniversaire** peu excitant, ex. « Im Dohwa — 30 ans ») + 1 event + « +6 more later ». Le contenu le plus riche (Recent comebacks, avec visuels) est relégué à droite. La hiérarchie ne met pas en avant le plus engageant. _Impact : modernité + rétention._
- **A2 — Landing = mur de noms de groupes.** _Preuve : `01-landing-d`._ Sous un hero correct, ~150 noms de groupes en 2 colonnes de texte. Aucune imagerie, aucun aperçu du calendrier/comebacks, aucune preuve sociale. Peu vendeur. _Impact : acquisition + 1ʳᵉ impression._
- **A3 — Surfaces fortes = les grids d'images.** _Preuve : `05-mvs-d`, `04-group-aespa-d` (Music videos 30)._ Quand il y a des thumbnails + notes, c'est dense et attractif. À répliquer ailleurs (home, landing).
- **A4 — LinksBar discrète.** _Preuve : `04`._ Icônes sociales petites/monochromes (couleur de marque seulement au survol) → peu de « pop » de marque sur la page artiste.
- **A5 — Empty states bruts.** _Preuve : `08` (My Groups « 0 »), `04` (« No upcoming events »), `06` (« No comments yet »)._ Texte plat, sans action proposée → sensation de produit vide.

### B. Modernité

- **B1 — Esthétique « sage ».** Propre mais peu de motion, peu de profondeur, peu de data-viz. Les concurrents modernes (_blip_, _bestofkpop_) jouent **countdowns animés** et **cartes visuelles**. _Preuve : absence de countdown hors la carte next-drop ; calendrier `09` aux pastilles minuscules._
- **B2 — PWA non « app-like » sur mobile.** _Preuve : `20-home-in-m`._ La home mobile est une **longue colonne empilée** (next-drop → filtres → nav → my groups → comebacks → discussions) ; la nav principale est **au milieu du scroll**, pas un bottom-tab fixe. Sur une cible ultra-mobile, ça casse l'illusion d'app.
- **B3 — Points forts de modernité réels** : dark-first, typographie soignée, gradient de marque, PWA installable. À assumer davantage.

### C. Navigation / usabilité

- **C1 — Pas de bottom nav persistante (mobile).** _Preuve : `20`, `22`._ La navigation inline disparaît au scroll → pour changer de section il faut remonter. Anti-pattern mobile. **Quick win à fort impact.**
- **C2 — Landing peu directrice.** _Preuve : `01`._ Le mur de groupes noie les CTA ; pas de chemin clair « voir le calendrier » sans créer de compte.
- **C3 — Findabilité du contenu.** Recherche présente sur Groups (bien), mais pas de recherche globale (groupe + MV + event). Filtres calendrier OK.
- **C4 — Profondeur OK** : 3 colonnes desktop lisibles, fil logique Upcoming/Calendar/MVs/Groups.

### D. Rétention (north-star)

- **D1 — Le vide est partout.** _Preuve : `08` (groupes suivis à « 0 »), `04`, `06`._ Un user qui suit peu de groupes (ou des groupes inactifs) arrive sur un calendrier/centre vides → churn J0. _C'est le finding n°1._
- **D2 — Aucun hook de retour daté.** Le push existe (VAPID prod + cron digest), mais **pas de trigger « comeback de ton groupe aujourd'hui / J-1 »** — exactement ce que fait _Bandsintown_ (alertes datées en 2 temps) et _blip_ (push schedule). _Impact rétention maximal, effort faible (infra déjà là)._
- **D3 — Différenciateur ratings froid.** _Preuve : `06`._ La note 1–10 + commentaires = ton arme unique vs tous les concurrents, mais l'écran est vide (0 note, 0 commentaire visibles) et l'engagement léger manque : **pas de like découplé de la note** (cf. Letterboxd) pour capter le tap mobile sans s'engager sur un chiffre.
- **D4 — Zéro preuve sociale / feed.** Pas de « X fans attendent ce comeback », pas de flux d'activité communautaire, pas de « tes groupes vs la communauté ». _blip/kpopping_ (UGC, missions) et _Letterboxd/Trakt_ (feed, follow d'users) en font des moteurs de rétention.
- **D5 — Profil sous-exploité.** Le profil ne capitalise pas l'investissement (nb suivis, MV notés, note moyenne, comeback le plus attendu) façon _MyAnimeList/Trakt_ → pas de « CV de fan » qui donne envie de remplir.
- **D6 — Pas de rétro/cadence.** Pas de « KStage Wrapped » ni de rendez-vous récurrent (digest hebdo daté) → manque l'habitude programmée (_Spotify Wrapped/Discover Weekly_).

---

## 4. Positionnement concurrentiel (condensé)

|                                     |    KStage     |    kpopping    | blip | bestofkpop | kpopofficial | kprofiles |
| ----------------------------------- | :-----------: | :------------: | :--: | :--------: | :----------: | :-------: |
| Calendrier + follow + comptes       |      ✅       |       ✅       |  ✅  |     ✗      |      ◐       |     ✗     |
| **Notes /10 + commentaires sur MV** | ✅ **unique** |       ◐        |  ✗   |     ✗      |      ◐       |     ◐     |
| Countdowns temps réel               |  ◐ (1 carte)  |       ◐        |  ✅  |     ✅     |      ✗       |     ✗     |
| Push datés par comeback             |   ◐ (infra)   |       ◐        |  ✅  | ◐ (email)  |      ✗       |     ✗     |
| Feed perso / "for you"              |       ◐       |       ◐        |  ✅  |     ✗      |      ✗       |     ✗     |
| Gamification / missions             |       ✗       |       ◐        |  ✅  |     ✗      |      ✗       |     ✗     |
| UGC (photos/wiki/fanlog)            |       ✗       |       ✅       |  ✅  |     ✗      |      ✗       |     ◐     |
| Modernité / app-feel                |      ✅       | ◐ (refonte V6) |  ✅  |     ✅     |      ◐       |     ✗     |

**Lecture :** KStage est à parité « plateforme » avec les deux leaders (_kpopping_, _blip_) et au-dessus des sites éditoriaux. Son **angle gagnant** = la **communauté de notation/critique** (territoire vide), pas la course à la gamification de _blip_ ni au wiki de _kpopping_ (trop lourds en solo). Les deux hooks à plus haut ROI/effort empruntés au marché : **countdowns** (_bestofkpop/blip_) et **push datés** (_Bandsintown/blip_).

---

## 5. Backlog priorisé (impact × effort)

> Réaliste pour un dev solo. Ordre = par ROI rétention.

### 🟢 Quick wins (jours) — impact élevé / effort faible

| #   | Reco                                                                                                                               | Dimension           | Source                   | À quoi ça ressemble                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------ | -------------------------------------------------------------------- |
| 1   | **Onboarding « follow d'abord »** : après signup, grille tappable des ~30 groupes les plus suivis → l'user suit 3-5 groupes en 15s | Rétention/Nav       | Letterboxd + Bandsintown | Le calendrier n'est **jamais vide** à la 1ʳᵉ session (anti-churn J0) |
| 2   | **Bottom nav fixe sur mobile** (Upcoming/Calendar/MVs/Groups)                                                                      | Nav/Modernité       | Pattern app standard     | La nav ne défile plus ; app-feel immédiat                            |
| 3   | **Like (cœur) sur MV, découplé de la note /10**                                                                                    | Rétention           | Letterboxd               | 1 tap léger pour la majorité mobile ; alimente la popularité         |
| 4   | **États vides actionnables** : « Suis un groupe pour remplir ton calendrier » + CTA ; « Sois le premier à noter »                  | Rétention/Design    | —                        | Aucun écran mort                                                     |
| 5   | **Countdown visible sur les comebacks à venir** (pas que la carte next-drop)                                                       | Modernité/Rétention | bestofkpop/blip          | FOMO + visites répétées avant chaque sortie                          |
| 6   | **Profil = vitrine de stats** (groupes suivis, MV notés, note moyenne, comeback le plus attendu)                                   | Rétention           | MAL/Trakt                | « CV de fan » qui donne envie de remplir                             |

### 🟡 Paris à effort moyen — impact élevé/moyen

| #   | Reco                                                                                                                                                                       | Dimension          | Source              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------- |
| 7   | **Push datés par comeback suivi** : « annoncé » + « J-1 / jour J » (réutilise VAPID)                                                                                       | Rétention          | Bandsintown/blip    |
| 8   | **Digest hebdo « ta semaine k-pop »** (push + option e-mail, RDV fixe)                                                                                                     | Rétention          | Bandsintown/Spotify |
| 9   | **Refonte de la home connectée** : centrer le contenu visuel (recent MVs/comebacks en grille), réduire le vide, hero plus pertinent que « prochain event quel qu'il soit » | Design/Modernité   | —                   |
| 10  | **Refonte landing** : aperçu visuel du calendrier/comebacks + preuve sociale, au lieu du mur de noms                                                                       | Acquisition/Design | bestofkpop          |
| 11  | **« J'attends ce comeback » (RSVP léger)** + compteur de hype → preuve sociale                                                                                             | Rétention          | Bandsintown         |
| 12  | **Feed d'activité communautaire** (notes/commentaires récents, global puis « amis »)                                                                                       | Rétention          | Letterboxd/Trakt    |

### 🔵 Plus tard — impact moyen / effort élevé ou saisonnier

| #   | Reco                                                                                       | Source                    |
| --- | ------------------------------------------------------------------------------------------ | ------------------------- |
| 13  | **KStage Wrapped** (rétro annuelle perso + carte partageable Stories) → acquisition virale | Spotify/Letterboxd (déc.) |
| 14  | **Listes custom partageables** (« top comebacks 2025 ») → contenu + SEO                    | Letterboxd                |
| 15  | **Reco « à suivre »** (par agence / co-occurrence de follows, sans ML)                     | Spotify/Last.fm           |

---

## 6. Séquencement recommandé

**Activation d'abord, habitude ensuite, viralité plus tard :**

1. **Anti-vide & app-feel** : #1 onboarding → #2 bottom nav → #4 empty states → #3 like → #6 profil stats. _(tout quick-win, attaque churn J0 + engagement léger)_
2. **Hooks de retour** : #7 push datés → #8 digest hebdo → #5 countdowns. _(crée le rendez-vous)_
3. **Profondeur produit** : #9 home → #10 landing → #12 feed → #11 RSVP. _(densité + social)_
4. **Coup d'acquisition** : #13 Wrapped (décembre).

> Garde-fou scope : ne pas chasser la gamification lourde de _blip_ ni le wiki de _kpopping_. L'avantage de KStage est la **communauté de notation** + une exécution propre — c'est là qu'il faut creuser.

## Annexe

Captures dans `.audit/` (desktop+mobile, connecté/déconnecté). Sources benchmark : kpopping.com, blip.kr, bestofkpop.com, kpopofficial.com, kprofiles.com ; Letterboxd, Last.fm, Bandsintown/Songkick, Trakt/MyAnimeList, Spotify (cf. liens dans la synthèse de session).
