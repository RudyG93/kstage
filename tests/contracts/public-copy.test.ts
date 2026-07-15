import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PUBLIC_COPY_FILES = [
  'README.md',
  'docs/KSTAGE_BRIEF.md',
  'docs/PROJECT.md',
  'public/manifest.webmanifest',
  'src/app/layout.tsx',
  'src/app/about/page.tsx',
  'src/lib/email/resend.ts',
  'src/components/notifications/notification-prefs.tsx',
] as const

const UNSUPPORTED_CLAIMS = [
  /events,\s*comebacks,\s*and lives/i,
  /music shows\s*(?:,|and|&)\s*lives/i,
  /comebacks,\s*music shows,\s*lives/i,
  /scheduled premieres and lives/i,
  /\*\*Lives officiels\*\*/i,
  /^### Lives\s*$/im,
] as const

describe.each(PUBLIC_COPY_FILES)('public product contract: %s', (relativePath) => {
  it('does not advertise live-event coverage', () => {
    const contents = readFileSync(resolve(process.cwd(), relativePath), 'utf8')

    for (const unsupportedClaim of UNSUPPORTED_CLAIMS) {
      expect(contents).not.toMatch(unsupportedClaim)
    }
  })
})
