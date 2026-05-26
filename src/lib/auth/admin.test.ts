import { describe, it, expect, afterEach } from 'vitest'
import { parseAdminEmails, isAdmin } from './admin'

describe('parseAdminEmails', () => {
  it('parse la CSV (trim, lowercase, ignore les vides)', () => {
    expect(parseAdminEmails(' A@x.com, b@Y.com ,, ')).toEqual(['a@x.com', 'b@y.com'])
  })
  it('vide ou undefined → []', () => {
    expect(parseAdminEmails(undefined)).toEqual([])
    expect(parseAdminEmails('')).toEqual([])
  })
})

describe('isAdmin', () => {
  const prev = process.env.ADMIN_EMAILS
  afterEach(() => {
    process.env.ADMIN_EMAILS = prev
  })

  it('matche un email de l’allowlist (insensible à la casse)', () => {
    process.env.ADMIN_EMAILS = 'admin@kstage.app, mod@kstage.app'
    expect(isAdmin('Admin@KStage.app')).toBe(true)
    expect(isAdmin('mod@kstage.app')).toBe(true)
    expect(isAdmin('stranger@x.com')).toBe(false)
  })
  it('null/undefined/email vide → false', () => {
    process.env.ADMIN_EMAILS = 'admin@kstage.app'
    expect(isAdmin(null)).toBe(false)
    expect(isAdmin(undefined)).toBe(false)
    expect(isAdmin('')).toBe(false)
  })
  it('allowlist vide → personne n’est admin', () => {
    process.env.ADMIN_EMAILS = ''
    expect(isAdmin('admin@kstage.app')).toBe(false)
  })
})
