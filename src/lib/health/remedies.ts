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
  'recover-mvs',
  'aired-shows',
  'discover-channels',
  'scrape-youtube',
  'scrape-music-shows',
] as const
export type TriggerableCron = (typeof TRIGGERABLE_CRONS)[number]

/**
 * Endpoint cron → `scrape_log.source` correspondant. Sert à RETROUVER le run
 * déclenché par un bouton et à en afficher le résultat réel (retour Rudy
 * 2026-08-21 : « quoi que je fasse, ça change rien » — le bouton annonçait
 * « Lancé ✓ » même quand l'API refusait, faute de boucle de retour).
 */
export const CRON_LOG_SOURCE: Record<TriggerableCron, string> = {
  'refresh-images': 'refresh_images',
  'recover-mvs': 'recover_mvs',
  'aired-shows': 'aired_shows',
  'discover-channels': 'channel_discovery',
  'scrape-youtube': 'youtube',
  'scrape-music-shows': 'music_shows',
}

/** Résumé lisible d'un run, pour l'afficher à côté du bouton. */
export function summarizeRun(
  source: string,
  status: string,
  details: unknown,
  errorMsg: string | null,
): string {
  const d = (details ?? {}) as Record<string, unknown>
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null)
  const parts: string[] = []
  if (source === 'recover_mvs') {
    const ins = num('inserted')
    const improved = num('groupsImproved')
    parts.push(ins === 0 ? 'aucun MV nouveau' : `${ins} MV récupérés sur ${improved} groupes`)
    const scanned = num('scanned')
    if (scanned !== null) parts.push(`${scanned} groupes scannés`)
  } else if (source === 'refresh_images') {
    const photos = (d.photos ?? {}) as Record<string, number>
    const images = (d.images ?? {}) as Record<string, unknown>
    if (typeof photos.updated === 'number')
      parts.push(`${photos.updated} photos résolues, ${photos.misses ?? 0} sans source`)
    if (typeof photos.sharedRejected === 'number' && photos.sharedRejected > 0)
      parts.push(`${photos.sharedRejected} photos de groupe écartées`)
    if (typeof images.updated === 'number') parts.push(`${images.updated} images groupe`)
    const aborted = images.aborted as { reason?: string } | null | undefined
    if (aborted?.reason) parts.push(`⚠ spotify ${aborted.reason}`)
    const mismatches = images.mismatches
    if (Array.isArray(mismatches) && mismatches.length > 0)
      parts.push(`${mismatches.length} liens Spotify à revoir`)
  } else if (source === 'aired_shows') {
    const eps = num('episodes_created')
    const passages = num('events_created')
    const stages = num('stages_linked')
    const nums = (num('numbers_filled') ?? 0) + (num('numbers_synced') ?? 0)
    const auth = (d.authority ?? {}) as Record<string, unknown>
    if (typeof auth.filled === 'number' || typeof auth.corrected === 'number') {
      parts.push(
        `autorité : ${auth.filled ?? 0} comblés, ${auth.corrected ?? 0} corrigés, ${auth.cleared ?? 0} effacés`,
      )
    }
    parts.unshift(
      `${eps ?? 0} épisodes, ${passages ?? 0} passages, ${stages ?? 0} scènes, ${nums} numéros`,
    )
    const unconfirmed = num('unconfirmed_count')
    if (unconfirmed) parts.push(`${unconfirmed} passages non confirmés`)
  } else if (source === 'channel_discovery') {
    const seeded = num('seeded')
    if (seeded !== null) parts.push(`${seeded} chaînes seedées`)
  }
  if (errorMsg) parts.push(`⚠ ${errorMsg}`)
  if (parts.length === 0) parts.push(status)
  return parts.join(' · ')
}

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
  mv_title_rejected: {
    kind: 'review',
    note: "Ces vidéos sont entrées sous une version antérieure du filtre de titre. Vérifier la liste, puis masquer d'un coup : `npx tsx scripts/audit-mv-titles.ts --hide` (revue seule sans le drapeau). `hidden` plutôt que DELETE : réversible, et la clé d'idempotence empêche la ré-insertion.",
  },
  spotify_link_mismatch: {
    kind: 'review',
    note: 'Le nom renvoyé par Spotify ne correspond pas au nom DB : soit le lien pointe le mauvais artiste (à corriger dans groups.links), soit Spotify localise le nom et il manque l’alias — ajouter la forme officielle dans groups.name_aliases. RIEN n’est écrit tant que le désaccord dure. Re-lancer le cron ne sert à rien : la donnée est à corriger à la main.',
  },
  members_sharing_photo: {
    kind: 'review',
    note: 'Ces membres portent la même image : fandom sert la photo de GROUPE (ou une pochette, un logo) quand la page perso n’a pas de portrait. L’écriture de nouveaux partages est bloquée depuis le 21/08 ; pour les lignes existantes, vider photo_source_key + photo_url du groupe concerné puis relancer la résolution — ils repasseront par les titres désambiguïsés. Arbitrage humain : sans portrait, la tuile retombe sur l’initiale.',
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
  thin_mv_catalogs: {
    kind: 'one_click',
    note: 'Récupère les MV par la discographie fandom — y compris ceux hébergés sur la chaîne du label, que le scraper de chaîne ne voit pas. ~2 units/groupe, tout le pool en un run.',
    cron: 'recover-mvs',
    buttonLabel: 'Récupérer les MV manquants',
  },
  debuted_without_mv: {
    kind: 'one_click',
    note: 'Un groupe qui a débuté A un MV : il est souvent sur la chaîne de son label, invisible du scraper de chaîne. Cette passe va le chercher dans la discographie fandom.',
    cron: 'recover-mvs',
    buttonLabel: 'Récupérer les MV manquants',
  },
  thin_rookies: {
    kind: 'auto',
    note: 'Debut < 90 j avec déjà un MV : le catalogue se remplit au fil des sorties — rien à faire.',
  },
  lineup_unmatched_pending: {
    kind: 'review',
    note: 'Artistes de lineup inconnus : la file candidate propose la création — valider/refuser.',
    href: '/admin/debuts',
    linkLabel: 'File debuts',
  },
  episodes_unnumbered: {
    kind: 'one_click',
    note: 'Le numéro vient du diffuseur (Mnet, Show Champion l’écrivent dans le titre de leurs vidéos) ou de l’autorité Wikipedia. Cette passe applique les deux.',
    cron: 'aired-shows',
    buttonLabel: 'Reconstruire depuis les diffuseurs',
  },
  episode_numbering_conflicts: {
    kind: 'one_click',
    note: 'Numéro contredit par l’autorité : la passe le réécrit depuis Wikipedia et réaligne toutes les tuiles de l’épisode sur le même numéro.',
    cron: 'aired-shows',
    buttonLabel: 'Reconstruire depuis les diffuseurs',
  },
  episodes_missing: {
    kind: 'one_click',
    note: 'Semaine sans épisode en base (hors 결방) : la chaîne du diffuseur porte les scènes diffusées ce jour-là — la passe reconstruit l’épisode et son lineup.',
    cron: 'aired-shows',
    buttonLabel: 'Reconstruire depuis les diffuseurs',
  },
  episodes_missing_stages: {
    kind: 'one_click',
    note: 'Plus de fenêtre : la scène est retrouvée par la date de diffusion écrite dans le titre de la vidéo, quelle que soit sa date de publication.',
    cron: 'aired-shows',
    buttonLabel: 'Reconstruire depuis les diffuseurs',
  },
  episodes_unconfirmed_lineup: {
    kind: 'review',
    note: 'Passage annoncé qu’aucune vidéo du diffuseur ne confirme : soit le lineup prévisionnel ne s’est pas réalisé (épisode spécial), soit il manque un alias au groupe. À trancher au cas par cas — jamais de purge auto.',
    href: '/admin/events',
    linkLabel: 'Admin events',
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
  solo_extra_members: {
    kind: 'review',
    note: 'Un artiste solo n’a QUE son membre Soloist. Une autre row est presque toujours le GROUPE dont il fait partie, importé à l’envers depuis MusicBrainz — à supprimer. La racine est corrigée depuis le 21/08 (direction de la relation).',
  },
  members_without_slug: {
    kind: 'review',
    note: 'Backfill : slug = {slug du groupe}-{stage name slugifié} (le membre Soloist d’un solo porte le slug du solo). Sans slug, la personne n’existe sur aucune surface.',
  },
  member_sort_names: {
    kind: 'review',
    note: 'Comparer au roster fandom (champs current/former) : fusionner le doublon dans la row au stage name, ou dé-inverser le nom. La racine est corrigée à l’ingestion depuis le 21/08.',
  },
  groups_without_members: {
    kind: 'review',
    note: 'Soit un soliste créé en groupe (kind fandom irrésolu → corriger is_solo + membre Soloist), soit un roster à compléter depuis l’infobox.',
  },
}
