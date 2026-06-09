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
