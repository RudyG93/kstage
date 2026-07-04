# RISKS — risques structurels connus (2026-07-04)

> La demi-page demandée par le backlog. Trois risques assumés, avec leur règle d'arbitrage. À relire avant toute décision d'ouverture publique.

## 1. r.jina.ai = SPOF de la couverture music shows

Toute la chaîne music shows (carrd primaire + fallbacks broadcasters, cf. `SCRAPING.md §9`) passe par le proxy gratuit `r.jina.ai` pour contourner JS/anti-bot/coréen. Service tiers gratuit, sans SLA, qui peut disparaître ou se mettre à servir du cache périmé (déjà observé).

**Règle d'arbitrage** : si Jina meurt, on accepte la dégradation (les music shows sont l'event le plus périssable — une semaine de trou est tolérable) plutôt que de scraper agressivement en direct contre `robots.txt`. Le widget Feedback sert de détecteur (users signalent les manques). Un proxy payant ne se justifie qu'avec une audience réelle.

## 2. Plafonds free tier — triggers de bascule (~45 $/mois)

- **Vercel Hobby** : usage non commercial uniquement, crons max 1×/jour chacun, 100 GB bandwidth/mois. Trigger : monétisation (premium) ou pic de trafic → **Pro 20 $/mois**.
- **Supabase Free** : 500 MB DB, 5 GB egress/mois, 50 K MAU. Les crons quotidiens maintiennent le projet actif (pas de pause d'inactivité). Trigger : DB > ~400 MB ou premier millier d'users actifs → **Pro 25 $/mois**.

**Règle** : vérifier les dashboards usage Vercel/Supabase avant tout soft launch ; la bascule totale (~45 $/mois) est le coût d'entrée connu d'une audience réelle, pas une surprise.

## 3. Minimum maintenable (anti burn-out)

L'app tourne **seule** : 6 crons quotidiens (scraping, digest, notifs, images), zéro op manuelle requise. Le minimum pour la garder en vie :

- **1 check hebdo (~10 min)** : dashboard Vercel Crons (runs en erreur — `scrape_log` rend les échecs visibles) + `/admin/feedback` + `/admin/suggestions`.
- **Rien d'autre n'est obligatoire.** Deux semaines sans y toucher ne cassent rien ; la seule surface qui pourrit est les parsers de scraping quand une source change de structure — et `scrape_log` le signale, pas besoin de le deviner.

**Règle** : les pauses sont prévues par le design, pas une faute. Reprendre par le check hebdo, pas par le backlog.
