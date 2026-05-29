export interface CommentAuthor {
  username: string | null
  avatar_url: string | null
}

export interface FlatComment {
  id: string
  event_id: string
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

export interface CommentNode extends FlatComment {
  children: CommentNode[]
}

export type SortMode = 'top' | 'new'

/**
 * Construit l'arbre récursif des commentaires depuis une liste plate.
 * Cas géré : si `parent_id` pointe vers un commentaire absent de la liste
 * (parent supprimé physiquement → `ON DELETE SET NULL` côté DB le couvre,
 * mais on garde la safety net si la liste filtre certains parents), le
 * commentaire est promu au niveau racine pour ne pas le perdre.
 *
 * Pure function : pas d'effet, déterministe, testable.
 */
export function buildCommentTree(flat: FlatComment[]): CommentNode[] {
  const nodes = new Map<string, CommentNode>()
  for (const c of flat) nodes.set(c.id, { ...c, children: [] })

  const roots: CommentNode[] = []
  for (const c of flat) {
    const node = nodes.get(c.id)!
    if (c.parent_id) {
      const parent = nodes.get(c.parent_id)
      if (parent) {
        parent.children.push(node)
        continue
      }
    }
    roots.push(node)
  }
  return roots
}

/**
 * Tri récursif d'un arbre déjà construit. Renvoie une nouvelle structure
 * (pas de mutation in-place côté caller).
 *
 * - `top` : score DESC ; tiebreaker created_at ASC (le plus ancien d'abord à
 *   score égal, pour stabilité — plus vieux = a eu plus de chance de voter).
 * - `new` : created_at DESC.
 *
 * Appliqué identiquement à chaque profondeur.
 */
export function sortTree(roots: CommentNode[], sort: SortMode): CommentNode[] {
  const cmp =
    sort === 'top'
      ? (a: CommentNode, b: CommentNode) => {
          if (b.score !== a.score) return b.score - a.score
          return a.created_at.localeCompare(b.created_at)
        }
      : (a: CommentNode, b: CommentNode) => b.created_at.localeCompare(a.created_at)
  function sortRec(nodes: CommentNode[]): CommentNode[] {
    return [...nodes].sort(cmp).map((n) => ({ ...n, children: sortRec(n.children) }))
  }
  return sortRec(roots)
}

/** Compte total des commentaires non soft-deleted dans un arbre. */
export function countVisible(roots: CommentNode[]): number {
  let n = 0
  function walk(nodes: CommentNode[]) {
    for (const node of nodes) {
      if (!node.deleted_at) n++
      walk(node.children)
    }
  }
  walk(roots)
  return n
}
