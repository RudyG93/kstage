import { describe, expect, it } from 'vitest'
import { fetchAllRows } from './paginate'

/** Fausse table paginée à la manière de PostgREST : jamais plus de 1000 lignes,
    et un `Content-Range` partiel qu'aucune erreur n'accompagne. */
function fakeTable(total: number) {
  const calls: [number, number][] = []
  const page = (from: number, to: number) => {
    calls.push([from, to])
    const size = Math.min(to - from + 1, 1000)
    const rows = Array.from({ length: Math.max(0, Math.min(size, total - from)) }, (_, i) => ({
      id: from + i,
    }))
    return Promise.resolve({ data: rows, error: null })
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('rend toutes les lignes au-delà du plafond de 1000', async () => {
    const { page, calls } = fakeTable(1268)
    const rows = await fetchAllRows(page)
    expect(rows).toHaveLength(1268)
    expect(rows[0]).toEqual({ id: 0 })
    expect(rows[1267]).toEqual({ id: 1267 })
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
    ])
  })

  it('une seule page quand la table tient sous le plafond', async () => {
    const { page, calls } = fakeTable(42)
    expect(await fetchAllRows(page)).toHaveLength(42)
    expect(calls).toHaveLength(1)
  })

  it('demande une page de plus quand la table fait exactement 1000 lignes', async () => {
    // Le cas piège : une page pleine ne prouve pas qu'il n'y a plus rien.
    const { page, calls } = fakeTable(1000)
    expect(await fetchAllRows(page)).toHaveLength(1000)
    expect(calls).toHaveLength(2)
  })

  it('table vide', async () => {
    const { page } = fakeTable(0)
    expect(await fetchAllRows(page)).toEqual([])
  })

  it('remonte une erreur au lieu de rendre un résultat partiel', async () => {
    let n = 0
    await expect(
      fetchAllRows<{ id: number }>(() => {
        n++
        return Promise.resolve(
          n === 1
            ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }
            : { data: null, error: { message: 'boom' } },
        )
      }),
    ).rejects.toThrow('boom')
  })
})
