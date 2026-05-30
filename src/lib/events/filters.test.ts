import { describe, expect, it } from 'vitest'
import { parseTypesParam, serializeTypesParam } from './filters'

describe('parseTypesParam', () => {
  it('returns empty array when raw is undefined or empty', () => {
    expect(parseTypesParam(undefined)).toEqual([])
    expect(parseTypesParam('')).toEqual([])
  })

  it('parses a single filterable type', () => {
    expect(parseTypesParam('mv')).toEqual(['mv'])
  })

  it('parses a CSV of multiple filterable types preserving order', () => {
    expect(parseTypesParam('mv,release,music_show')).toEqual(['mv', 'release', 'music_show'])
  })

  it('trims whitespace around tokens', () => {
    expect(parseTypesParam(' mv , release ')).toEqual(['mv', 'release'])
  })

  it('drops unknown or non-filterable types (live and other are not filterable)', () => {
    expect(parseTypesParam('mv,bogus,live,other,release')).toEqual(['mv', 'release'])
  })

  it('de-duplicates repeated types', () => {
    expect(parseTypesParam('mv,mv,release,mv')).toEqual(['mv', 'release'])
  })
})

describe('serializeTypesParam', () => {
  it('joins types with commas', () => {
    expect(serializeTypesParam(['mv', 'release'])).toBe('mv,release')
  })

  it('returns empty string for an empty array', () => {
    expect(serializeTypesParam([])).toBe('')
  })
})
