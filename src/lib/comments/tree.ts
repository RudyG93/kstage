export interface CommentAuthor {
  username: string | null
  avatar_url: string | null
}

export interface FlatComment {
  id: string
  /** null pour les commentaires d'ÉPISODE de music show (episode_id, Lot N). */
  event_id: string | null
  user_id: string
  parent_id: string | null
  body: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  author: CommentAuthor | null
  score: number
  userVote: -1 | 1 | null
}

/** Le destinataire d'une réponse, quand ce n'est pas la tête du fil. */
export interface ReplyTarget {
  id: string
  username: string | null
}

export interface CommentNode extends FlatComment {
  /** Réponses du fil, À PLAT : toute profondeur est ramenée à ce seul niveau. */
  replies: CommentNode[]
  /**
   * Le commentaire auquel celui-ci répond, quand ce n'est PAS la tête du fil.
   * C'est lui qui remplace l'imbrication : « → @alice » dit le contexte que
   * l'indentation disait avant, sans coûter de largeur.
   */
  replyTo: ReplyTarget | null
}

export type SortMode = 'top' | 'new'

/**
 * Construit les fils depuis la liste plate : une tête, puis TOUTES ses
 * descendances au même niveau, dans l'ordre chronologique.
 *
 * Pourquoi pas l'imbrication complète (modèle Reddit) — mesuré le 2026-08-23 :
 * chaque niveau coûtait 28 px, soit une colonne de texte de 155 px au plancher
 * sur un écran de 375 px (~22 caractères par ligne, contre 45-75 pour une
 * lecture confortable). Et le volume ne le demandait pas. Le `parent_id` reste
 * écrit et intact en base : re-basculer vers un rendu imbriqué ne demanderait
 * aucune migration.
 *
 * Un `parent_id` qui pointe hors de la liste promeut le commentaire en tête de
 * fil plutôt que de le perdre.
 *
 * Itératif, pas récursif : une chaîne de réponses assez longue faisait sauter
 * la pile côté serveur, et la page devenait inaccessible pour tout le monde.
 * La base borne maintenant la profondeur à 8 (migration 0070), mais la
 * construction ne doit pas dépendre de cette borne.
 *
 * Fonction pure : pas d'effet, déterministe, testable.
 */
export function buildCommentThreads(flat: FlatComment[]): CommentNode[] {
  const parMoi = new Map<string, FlatComment>()
  for (const c of flat) parMoi.set(c.id, c)

  /** Remonte jusqu'à la tête de fil. Bornée : un cycle ne doit pas boucler. */
  const teteDeFil = (c: FlatComment): FlatComment => {
    let courant = c
    for (let garde = 0; garde < 64; garde++) {
      if (!courant.parent_id) return courant
      const parent = parMoi.get(courant.parent_id)
      if (!parent) return courant
      courant = parent
    }
    return courant
  }

  const noeuds = new Map<string, CommentNode>()
  const tetes: CommentNode[] = []
  for (const c of flat) {
    if (c.parent_id && parMoi.has(c.parent_id)) continue
    const n: CommentNode = { ...c, replies: [], replyTo: null }
    noeuds.set(c.id, n)
    tetes.push(n)
  }

  for (const c of flat) {
    if (!c.parent_id || !parMoi.has(c.parent_id)) continue
    const tete = noeuds.get(teteDeFil(c).id)
    if (!tete) continue
    const parent = parMoi.get(c.parent_id)!
    tete.replies.push({
      ...c,
      replies: [],
      // Le destinataire n'est affiché que s'il diffère de la tête : « → @X »
      // sur la première réponse d'un fil ne dit rien qu'on ne voie déjà.
      replyTo:
        parent.id === tete.id ? null : { id: parent.id, username: parent.author?.username ?? null },
    })
  }

  // Une conversation se lit dans l'ordre où elle s'est tenue.
  for (const t of tetes) t.replies.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return tetes
}

/**
 * Trie les TÊTES de fil. Les réponses gardent leur ordre chronologique — un
 * échange trié par score se lit à l'envers.
 *
 * - `top` : score DESC. Un commentaire retiré tombe en fin de liste quel que
 *   soit son score : ouvrir la discussion sur « [deleted] » était le cas réel
 *   des deux seules pages commentées de la prod.
 * - `new` : created_at DESC.
 */
export function sortThreads(tetes: CommentNode[], sort: SortMode): CommentNode[] {
  const retire = (n: CommentNode) => (n.deleted_at ? 1 : 0)
  const cmp =
    sort === 'top'
      ? (a: CommentNode, b: CommentNode) => {
          if (retire(a) !== retire(b)) return retire(a) - retire(b)
          if (b.score !== a.score) return b.score - a.score
          return a.created_at.localeCompare(b.created_at)
        }
      : (a: CommentNode, b: CommentNode) => {
          if (retire(a) !== retire(b)) return retire(a) - retire(b)
          return b.created_at.localeCompare(a.created_at)
        }
  return [...tetes].sort(cmp)
}

/** Nombre de commentaires non retirés, têtes et réponses confondues. */
export function countVisible(tetes: readonly CommentNode[]): number {
  let n = 0
  for (const t of tetes) {
    if (!t.deleted_at) n++
    for (const r of t.replies) if (!r.deleted_at) n++
  }
  return n
}
