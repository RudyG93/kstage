# docs/ — index documentaire

> Mis en place le 2026-06-12 (audit complet). **Règle** : un seul document par rôle ; tout claim d'état prod est daté et sourcé.

## Par où commencer

| Rôle                                                    | Document                                              | Statut                                                                             |
| ------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **Découvrir le projet** (handoff)                       | `KSTAGE_BRIEF.md`                                     | Vivant — mis à jour 2026-06-12                                                     |
| **Contexte produit & technique** (le « quoi/pourquoi ») | `PROJECT.md` (état courant : §9)                      | Vivant                                                                             |
| **Roadmap active** (le « quoi maintenant »)             | `BACKLOG.md`                                          | Vivant — réécrit 2026-06-12, source de vérité des priorités                        |
| **Journal de bord** (le « qu'a-t-on fait, quand »)      | `JOURNAL.md`                                          | Vivant — créé 2026-07-05, une entrée par merge (règle CLAUDE.md § Journal)         |
| **Risques structurels** (SPOF, free tiers, burn-out)    | `RISKS.md`                                            | Vivant — créé 2026-07-04                                                           |
| **Constats vérifiés** (le « qu'est-ce qui ne va pas »)  | `AUDIT_PROJET_2026-06-12.md`                          | Référence datée                                                                    |
| Audit UX / benchmark                                    | `AUDIT_UX_2026-06.md`                                 | Référence datée (2026-06-08) — le backlog §5/§6 est **supersédé** par `BACKLOG.md` |
| Audit sécurité                                          | `SECURITY_AUDIT.md`                                   | Vivant — corrigé 2026-06-12                                                        |
| Audit performance                                       | `PERFORMANCE_AUDIT.md`                                | Vivant — baseline avant/après roadmap (2026-07-16)                                 |
| Scraping (archi, pièges, diagnostics)                   | `SCRAPING.md`                                         | Vivant — à lire **avant** de toucher un scraper (règle CLAUDE.md)                  |
| Règles de travail                                       | `../CLAUDE.md` (+ parent) et `../AGENTS.md` (Next 16) | Vivants                                                                            |

## Historique (ne pas utiliser comme roadmap)

- `archive/KSTAGE_MVP_FINALIZATION.md` — plan MVP (exécuté).
- `archive/KSTAGE_FIXES_AND_POLISH.md` — lot fixes/polish (exécuté).
- `archive/KSTAGE_POLISH_PERF_DATA.md` — lot polish/perf/data (largement exécuté ; bannière de corrections en tête).
- `archive/INTEGRATION_theme_2026-06-16.md` — compte-rendu d'intégration du thème Daylight/Midnight (exécuté ; supersédé par le JOURNAL).
- `archive/kstage-audit-strategique-2026-07-15.md` — audit stratégique pilotant la roadmap lancement 0→5.
- `plans/` — plans d'étape détaillés du MVP (références d'époque).
- `email-templates/` — templates e-mail Supabase (exclus de Prettier).
