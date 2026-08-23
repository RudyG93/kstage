// Avatars orphelins : objets du bucket `avatars` qu'aucun profil ne référence.
//
// `updateAvatar` écrit un chemin NEUF à chaque upload puis retire l'ancien —
// sauf que `storage.remove()` résout d'abord l'objet par un SELECT, et 0035
// avait retiré la policy SELECT du bucket : le retrait ne trouvait rien et
// ne supprimait donc rien. 0067 rétablit un SELECT limité au dossier de
// l'user, ce qui règle les uploads FUTURS ; ce script solde l'arriéré (12
// orphelins sur 14 objets au 2026-08-23, toujours servis publiquement).
//
//   npx tsx scripts/prune-orphan-avatars.ts           (revue, aucune écriture)
//   npx tsx scripts/prune-orphan-avatars.ts --apply   (supprime)
//
// Un objet n'est proposé que s'il est ANCIEN (> 24 h) : un upload en cours de
// route pourrait sinon être supprimé entre le put et l'écriture du profil.
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/database'

loadEnvConfig(process.cwd())

const APPLY = process.argv.includes('--apply')
const GRACE_MS = 24 * 60 * 60 * 1000

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('avatar_url')
    .not('avatar_url', 'is', null)
  if (profErr) throw new Error(profErr.message)
  const referenced = new Set(
    (profiles ?? [])
      .map((p) => p.avatar_url!.split('/avatars/')[1])
      .filter((p): p is string => Boolean(p)),
  )

  // Le bucket est plat au niveau racine mais rangé par dossier user : on liste
  // dossier par dossier (list() ne descend pas récursivement).
  const { data: folders, error: listErr } = await supabase.storage.from('avatars').list('', {
    limit: 1000,
  })
  if (listErr) throw new Error(listErr.message)

  const objects: { path: string; createdAt: string; size: number }[] = []
  for (const f of folders ?? []) {
    if (f.id) continue // fichier à la racine, pas un dossier
    const { data: files } = await supabase.storage.from('avatars').list(f.name, { limit: 1000 })
    for (const file of files ?? []) {
      objects.push({
        path: `${f.name}/${file.name}`,
        createdAt: file.created_at ?? '',
        size: (file.metadata?.size as number) ?? 0,
      })
    }
  }

  const now = Date.now()
  const orphans = objects.filter(
    (o) => !referenced.has(o.path) && (!o.createdAt || now - Date.parse(o.createdAt) > GRACE_MS),
  )

  const poids = orphans.reduce((n, o) => n + o.size, 0)
  console.log(
    `${objects.length} objets, ${referenced.size} référencés — ${orphans.length} orphelins (${Math.round(poids / 1024)} Ko)`,
  )
  for (const o of orphans) console.log(`   ${o.path}  ${Math.round(o.size / 1024)} Ko`)

  if (!APPLY || orphans.length === 0) {
    if (!APPLY) console.log('\n(revue seule — relancer avec --apply pour supprimer)')
    return
  }
  const { error } = await supabase.storage.from('avatars').remove(orphans.map((o) => o.path))
  if (error) throw new Error(error.message)
  console.log(`\n${orphans.length} objets supprimés`)
}

main()
