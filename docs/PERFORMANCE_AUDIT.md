# KStage — Audits performance

## Baseline 2026-07-16 — avant Phase 2 (Lighthouse 12.8.2, mobile, prod)

> Action 11 de la Phase 2 (audit stratégique §12) : mesurer AVANT les changements
> UX des Lots 2-5, re-mesurer après le Lot 5 pour l'avant/après. Émulation
> mobile Lighthouse par défaut, catégories perf + a11y, `kstage.vercel.app`,
> anonyme (la home connectée n'est pas mesurable sans session — noté).

| Page (mobile) | Perf   | A11y | LCP       | CLS   | TBT    | FCP   | Speed Index |
| ------------- | ------ | ---- | --------- | ----- | ------ | ----- | ----------- |
| `/` (landing) | **62** | 95   | 4.9 s     | 0.249 | 190 ms | 1.1 s | 5.7 s       |
| `/calendar`   | **73** | 96   | 4.0 s     | 0.249 | 150 ms | 1.2 s | 2.5 s       |
| `/mvs`        | **54** | 100  | **7.0 s** | 0.249 | 300 ms | 1.1 s | 4.7 s       |

Lectures :

1. **CLS 0.249 identique sur les 3 pages** → une cause PARTAGÉE (layout global :
   ticker/header/fonts qui décalent au chargement), pas un problème par page.
   Un seul fix global devrait remonter les 3 scores.
2. **LCP 4-7 s** : le LCP est une image (hero/mur/vignettes YouTube) non
   priorisée — cohérent avec le FCP sain (~1.1 s) : le squelette arrive vite,
   le visuel principal tard.
3. `/mvs` (54) = le plus dégradé : grille de vignettes YouTube + chart.
4. A11y déjà ≥ 95 partout — le Lot 4 (a11y-pass) vise les points NON mesurés
   par Lighthouse (skip-link, headings, ticker SR, reduced-motion).

> Fixes : PAS dans le Lot 1 (baseline seulement). Candidats à trier au re-run
> post-Lot 5 : cause CLS commune, `priority`/`fetchpriority` sur l'image LCP.

---

# KStage — Audit performance (2026-06-09)

> Mesures **réelles** en prod (Playwright, navigation timing) AVANT toute optimisation (§2.1 du doc Polish/Perf/Data). But : ne pas optimiser à l'aveugle.

## Mesures (prod, déconnecté)

| Page                              |         TTFB | Load (loadEventEnd) |    Wall |
| --------------------------------- | -----------: | ------------------: | ------: |
| `/` (landing)                     |  **2873 ms** |         **6035 ms** | 6079 ms |
| `/calendar`                       | 25 ms (warm) |             1759 ms | 1794 ms |
| `/mvs`                            |        24 ms |             1698 ms | 1770 ms |
| `/groups`                         |        24 ms |             1205 ms | 1267 ms |
| **Clic filtre type (round-trip)** |            — |           **63 ms** |       — |

## Findings

1. **Cold start serverless** : le 1er hit (`/`) a un TTFB de ~2.9s ; les suivants ~25ms (fonction chaude). → la 1ʳᵉ interaction après inactivité est lente. Mitigation : `revalidate`/ISR sur les pages publiques, ou cron de warm-up. (Caractéristique Vercel, pas un bug applicatif.)
2. **Landing `/` lente même hors cold-start** : rend ~150 groupes (le mur « Now tracking ») → DCL 6s. → alléger (cache `revalidate`, réduire/paginer la liste, ou refonte landing prévue à l'audit UX §10).
3. **Clic de filtre = 63ms → PAS le goulot** (contredit l'hypothèse du doc). Ne PAS optimiser les filtres à l'aveugle. ⚠️ À nuancer : mesuré déconnecté ; l'impression « filtres lents » de Rudy peut venir du cold-start, des pages connectées plus chargées, ou de l'absence de **feedback de chargement** (pas de spinner → ressenti lent même à 200ms).
4. Pages chaudes ~1.2–1.8s : correct, améliorable via caching des queries rarement changeantes (liste groupes) et `next/image` priorité.

## Plan de fixes (ciblé sur les findings, pas l'hypothèse)

- **Caching** : `export const revalidate = 3600` sur les pages à données stables (landing, /groups) ; `unstable_cache` sur `getGroups` (change rarement).
- **Landing** : alléger le render (la refonte de l'audit UX la remplacera de toute façon).
- **Feedback de chargement** : ajouter des `loading.tsx` / états de transition (`useLinkStatus`/`useTransition`) pour que les navigations « paraissent » instantanées.
- **Warm-up** (optionnel) : ping cron léger pour limiter les cold starts.
- Re-mesurer après (cibles doc : LCP <2.5s, navigation <500ms).

> Conclusion : l'optim prioritaire n'est PAS les filtres (rapides) mais le **cold-start + landing + le feedback de chargement**.
