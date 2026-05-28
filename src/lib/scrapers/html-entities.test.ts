import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities } from './html-entities'

describe('decodeHtmlEntities', () => {
  it('décode les entités numériques décimales (cas YouTube principal)', () => {
    expect(decodeHtmlEntities('aespa &#39;LEMONADE&#39; MV Teaser')).toBe(
      "aespa 'LEMONADE' MV Teaser",
    )
  })

  it('décode les entités numériques hex', () => {
    expect(decodeHtmlEntities('&#x27;test&#x27;')).toBe("'test'")
  })

  it('décode les entités nommées courantes', () => {
    expect(decodeHtmlEntities('Rock &amp; Roll')).toBe('Rock & Roll')
    expect(decodeHtmlEntities('5 &lt; 10 &gt; 3')).toBe('5 < 10 > 3')
    expect(decodeHtmlEntities('She said &quot;hello&quot;')).toBe('She said "hello"')
    expect(decodeHtmlEntities('non&nbsp;breaking')).toBe('non breaking')
  })

  it('décode un mix entités + texte brut + Unicode', () => {
    expect(decodeHtmlEntities('aespa 에스파 &#39;Supernova&#39;')).toBe("aespa 에스파 'Supernova'")
  })

  it('laisse intacte une entité inconnue', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
  })

  it('chaîne vide → vide', () => {
    expect(decodeHtmlEntities('')).toBe('')
  })

  it("n'introduit pas de double-decode si l'input contient déjà des apostrophes", () => {
    expect(decodeHtmlEntities("aespa 'Whiplash'")).toBe("aespa 'Whiplash'")
  })
})
