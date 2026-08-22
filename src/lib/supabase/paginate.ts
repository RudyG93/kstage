/**
 * Lecture complète d'une table malgré le plafond PostgREST.
 *
 * Le projet est configuré à `db-max-rows = 1000` et ce plafond est DUR :
 * `.limit(2000)` renvoie quand même 1000 lignes, avec un `206 Partial Content`
 * et un `Content-Range: 0-999/1268` que le client Supabase ne remonte pas comme
 * une erreur. Une requête non bornée sur une table dépassant 1000 lignes rend
 * donc un résultat FAUX en silence — vérifié le 2026-08-22 sur `members`
 * (1268 lignes) et `events` (4165 visibles).
 *
 * `page` doit construire une requête NEUVE à chaque appel : les builders
 * PostgREST sont mutables (`.is()` and co. modifient et retournent `this`),
 * réutiliser le même objet entre deux pages accumule les filtres.
 *
 * La requête DOIT porter un `.order()` stable. Sans ordre, Postgres n'a
 * aucune obligation de rendre les mêmes lignes d'un OFFSET à l'autre : des
 * lignes peuvent se répéter d'une page à l'autre et d'autres disparaître.
 */
const PAGE_SIZE = 1000

export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}
