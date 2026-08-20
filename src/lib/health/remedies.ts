// Remède par check du data-health monitor (Lot 5 peaufinage 2026-08-20) :
// chaque problème affiché doit dire COMMENT il se résout — sans ça, la page
// liste des soucis sans être gérable (retour Rudy).
//
// Trois familles :
// - `auto`      : un cron le résorbe tout seul — rien à faire, on affiche qui.
// - `one_click` : bouton qui déclenche le cron réparateur MAINTENANT (server
//                 action gardée admin, fetch Bearer CRON_SECRET en after()).
// - `review`    : décision humaine requise — lien vers la surface où agir.

/** Crons déclenchables depuis /admin/health — liste FERMÉE : jamais les crons
    d'ENVOI (notify-comebacks, send-digest — leçon verify-automation-state). */
export const TRIGGERABLE_CRONS = [
  'refresh-images',
  'discover-channels',
  'scrape-youtube',
  'scrape-music-shows',
] as const
export type TriggerableCron = (typeof TRIGGERABLE_CRONS)[number]

export type Remedy =
  | { kind: 'auto'; note: string }
  | { kind: 'one_click'; note: string; cron: TriggerableCron; buttonLabel: string }
  | { kind: 'review'; note: string; href?: string; linkLabel?: string }

export const REMEDIES: Record<string, Remedy> = {
  members_without_photo: {
    kind: 'one_click',
    note: 'Le cron quotidien refresh-images re-résout les photos manquantes (fandom).',
    cron: 'refresh-images',
    buttonLabel: 'Relancer la résolution photos',
  },
  oversized_photos: {
    kind: 'review',
    note: 'Objet servi > 400 Ko : ré-ingérer la photo via l’admin images (resize à l’ingestion).',
    href: '/admin/images',
    linkLabel: 'Admin images',
  },
  oversized_orphans: {
    kind: 'review',
    note: 'Objets Storage non référencés — purge manuelle réfléchie (vérifier qu’aucune URL ne pointe dessus).',
  },
  dead_image_urls: {
    kind: 'one_click',
    note: 'Photo membre morte/corrompue : refresh-images re-résout. Thumbnail YouTube 404 : le repli client couvre déjà.',
    cron: 'refresh-images',
    buttonLabel: 'Relancer la résolution photos',
  },
  thin_rookies: {
    kind: 'auto',
    note: 'Debut < 90 j : le catalogue se remplit avec les sorties — rien à faire.',
  },
  thin_mv_catalogs: {
    kind: 'one_click',
    note: 'Le cron discover-channels (lundi, 20 groupes/run) draine la file — déclenchable tout de suite.',
    cron: 'discover-channels',
    buttonLabel: 'Lancer une passe discover',
  },
  lineup_unmatched_pending: {
    kind: 'review',
    note: 'Artistes de lineup inconnus : la file candidate propose la création — valider/refuser.',
    href: '/admin/debuts',
    linkLabel: 'File debuts',
  },
  episodes_unnumbered: {
    kind: 'one_click',
    note: 'Épisodes récents : un re-scrape peut combler le numéro. Les anciens exigent une source autoritaire.',
    cron: 'scrape-music-shows',
    buttonLabel: 'Re-scraper les music shows',
  },
  episode_numbering_conflicts: {
    kind: 'review',
    note: 'Numéro parsé faux OU épisodes manquants : vérifier contre une source autoritaire — jamais deviner.',
    href: '/admin/events',
    linkLabel: 'Admin events',
  },
  episodes_missing_stages: {
    kind: 'review',
    note: 'Fenêtre d’enrichissement (air +4 j) passée : backfill requis — `npx tsx scripts/backfill-stage-links.ts`.',
  },
  placeholder_titles: {
    kind: 'review',
    note: 'Titre générique « X debut » : renseigner le vrai titre depuis l’admin events.',
    href: '/admin/events',
    linkLabel: 'Admin events',
  },
  predebut_incomplete: {
    kind: 'review',
    note: 'Dossier pre-debut incomplet (membres/photo/source) : compléter à l’approche du debut.',
    href: '/admin/debuts',
    linkLabel: 'File debuts',
  },
  stale_sources: {
    kind: 'one_click',
    note: 'Source muette depuis > 7 j : un re-scrape dit si c’est un creux réel ou une source cassée.',
    cron: 'scrape-youtube',
    buttonLabel: 'Re-scraper YouTube',
  },
  scrape_errors_recent: {
    kind: 'auto',
    note: 'Un run en erreur se rejoue au prochain cron ; si l’erreur persiste 2 jours, lire scrape_log.details.',
  },
  duplicate_person_candidates: {
    kind: 'review',
    note: 'Même personne sous 2 groupes : fusion manuelle réfléchie (canonical_id) — jamais automatique.',
  },
  solo_without_soloist_member: {
    kind: 'review',
    note: 'Créer le membre position=Soloist (patron Lisa : slug = slug du solo) + canonical du membership groupe → Soloist.',
  },
  agency_wikitext_residue: {
    kind: 'review',
    note: 'Champ agency fandom mal parsé : re-fetch l’infobox avec parseAgency (segments « present » seulement).',
  },
  groups_without_members: {
    kind: 'review',
    note: 'Soit un soliste créé en groupe (kind fandom irrésolu → corriger is_solo + membre Soloist), soit un roster à compléter depuis l’infobox.',
  },
}
