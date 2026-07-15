# Public Product Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Make KStage's first beta-facing product contract truthful by separating group follows from push notifications and removing live events from launch-facing surfaces while preserving legacy data compatibility.

**Architecture:** Keep the hero's dedicated visual treatment, but make its client CTA use the same optimistic follow/unfollow pattern already proven by FollowButton. Move hero eligibility into a pure selector so launch scope is tested without importing the async home page. Guard notification preferences and static product copy with focused component and contract tests; retain the internal live enum, labels, routing, scraper handling, and historical rows.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4, TypeScript strict, Tailwind CSS v4, Supabase Server Actions/RLS, Vitest 4.1.7, Testing Library 16.3.2, Playwright 1.60.0.

## Global Constraints

- Read the bundled Next.js 16 guides listed below before production edits; do not rely on pre-16 conventions.
- Public launch categories are exactly releases, music videos, music shows, birthdays, and debut anniversaries.
- Hero-eligible database types are exactly mv, release, and music_show.
- Following a group never implies notification permission, a push subscription, or enabled notification delivery.
- The signed-out follow control is a link to /login; signed-in mutations use a semantic button with aria-pressed.
- Keep setOptimistic(...) and await toggleFollow(...) inside the same explicit startTransition(async () => ...).
- Keep the authenticated Server Action and RLS authoritative; do not trust isAuthed, groupId, or follow state as authorization.
- Retain disabled={pending} to prevent duplicate Server Action submissions.
- Catch mutation rejection inside the transition and use the generic Sonner error toast; do not expose database details.
- Do not add router.refresh(), updateTag(), revalidateTag(), a database migration, or new dependencies.
- Keep internal live compatibility in database types, migrations, labels, colors, routing, notification reads, scrapers, and historical rendering.
- Leave dated audits, journal entries, archived documents, and docs/plans/\*\* unchanged.
- Use npm.cmd rather than npm in PowerShell because script execution policy blocks npm.ps1.
- Use apply_patch for file creation, modification, and deletion.

## Required Next.js 16 Reading

Read these files in full before Task 1 production code:

- node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md
- node_modules/next/dist/docs/01-app/02-guides/forms.md
- node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md
- node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md
- node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-client.md
- node_modules/next/dist/docs/01-app/03-api-reference/01-directives/use-server.md
- node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md

The implementation relies on four documented behaviors:

1. Event-handler Server Actions require an explicit transition.
2. useOptimistic is temporary until the server-rendered base prop is reconciled.
3. Unhandled transition errors reach an error boundary, so this expected failure is caught locally.
4. The existing Server Action's revalidatePath('/') is server-only and sufficient for the home route.

## File Map

### Create

- src/components/home/notify-cta.test.tsx — jsdom behavior tests for signed-out, follow, unfollow, pending, reconciliation, rollback, toast, and icon accessibility.
- src/lib/events/hero.ts — pure home-hero eligibility selector.
- src/lib/events/hero.test.ts — launch-scope selection tests.
- src/components/notifications/notification-prefs.test.tsx — visible preference-category contract.
- tests/contracts/public-copy.test.ts — regression guard for unsupported public live-event claims.

### Modify

- src/components/home/notify-cta.tsx — truthful Follow/Following behavior while preserving hero styling.
- src/components/home/next-drop-card.test.tsx — integration expectations for the corrected CTA.
- src/app/(home)/page.tsx — consume the pure hero selector instead of a local set that includes live.
- src/components/home/type-badge.test.tsx — protect legacy live rendering.
- src/components/notifications/notification-prefs.tsx — remove the Lives row and stale five-toggle comment.
- src/lib/notifications/actions.ts — clarify that server acceptance of live is retained only for compatibility.
- README.md, src/app/layout.tsx, public/manifest.webmanifest, src/app/about/page.tsx, and src/lib/email/resend.ts — truthful public copy.
- docs/KSTAGE_BRIEF.md and docs/PROJECT.md — truthful active product documentation.

### Preserve Unchanged

- src/lib/follows/actions.ts — already authenticates, inserts/deletes according to current state, and revalidates / and /groups.
- src/types/database.ts, supabase/migrations/\*\*, src/lib/events/labels.ts, src/lib/events/href.ts, and src/lib/scrapers/youtube.ts — required legacy compatibility.
- tests/e2e/smoke.spec.ts references to “events tracked live” and tests/e2e/search.spec.ts references to live search — realtime wording, not event-category claims.

---

### Task 1: Correct the hero follow CTA

**Files:**

- Create: src/components/home/notify-cta.test.tsx
- Modify: src/components/home/notify-cta.tsx
- Modify: src/components/home/next-drop-card.test.tsx

**Interfaces:**

- Consumes: toggleFollow(groupId: string, isFollowing: boolean): Promise<void>.
- Produces: NotifyCta({ groupId, initialFollowing, isAuthed }) with truthful follow semantics.
- The Server Action argument is current state: false inserts a follow and true removes it.

- [ ] **Step 1: Add the failing CTA behavior tests**

Create src/components/home/notify-cta.test.tsx:

```tsx
// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/follows/actions', () => ({ toggleFollow: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { toggleFollow } from '@/lib/follows/actions'
import { toast } from 'sonner'
import { NotifyCta } from './notify-cta'

const toggleFollowMock = vi.mocked(toggleFollow)
const toastErrorMock = vi.mocked(toast.error)

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('NotifyCta', () => {
  beforeEach(() => {
    toggleFollowMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('sends signed-out users to login with truthful copy', () => {
    render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed={false} />)

    const link = screen.getByRole('link', { name: 'Follow' })
    expect(link).toHaveAttribute('href', '/login')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText(/notify/i)).not.toBeInTheDocument()
  })

  it.each([
    {
      initialFollowing: false,
      initialLabel: 'Follow',
      optimisticLabel: 'Following',
      optimisticPressed: 'true',
    },
    {
      initialFollowing: true,
      initialLabel: 'Following',
      optimisticLabel: 'Follow',
      optimisticPressed: 'false',
    },
  ])(
    'toggles from $initialLabel with the current-state action argument',
    async ({ initialFollowing, initialLabel, optimisticLabel, optimisticPressed }) => {
      const request = deferred<void>()
      toggleFollowMock.mockReturnValueOnce(request.promise)
      const user = userEvent.setup()
      render(<NotifyCta groupId="g1" initialFollowing={initialFollowing} isAuthed />)

      const initialButton = screen.getByRole('button', { name: initialLabel })
      expect(initialButton).toHaveAttribute('aria-pressed', String(initialFollowing))
      expect(initialButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

      await user.click(initialButton)

      const optimisticButton = screen.getByRole('button', { name: optimisticLabel })
      expect(optimisticButton).toHaveAttribute('aria-pressed', optimisticPressed)
      expect(optimisticButton).toBeDisabled()
      expect(toggleFollowMock).toHaveBeenCalledWith('g1', initialFollowing)

      await user.click(optimisticButton)
      expect(toggleFollowMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        request.resolve(undefined)
        await request.promise
      })
    },
  )

  it('keeps the newly confirmed state after server reconciliation', async () => {
    const request = deferred<void>()
    toggleFollowMock.mockReturnValueOnce(request.promise)
    const user = userEvent.setup()
    const { rerender } = render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed />)

    await user.click(screen.getByRole('button', { name: 'Follow' }))
    rerender(<NotifyCta groupId="g1" initialFollowing isAuthed />)

    await act(async () => {
      request.resolve(undefined)
      await request.promise
    })

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Following' })
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(button).not.toBeDisabled()
    })
  })

  it('rolls back and reports a generic error when the mutation fails', async () => {
    const request = deferred<void>()
    toggleFollowMock.mockReturnValueOnce(request.promise)
    const user = userEvent.setup()
    render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed />)

    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(screen.getByRole('button', { name: 'Following' })).toBeDisabled()

    await act(async () => {
      request.reject(new Error('database detail'))
      await request.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Follow' })).not.toBeDisabled()
      expect(toastErrorMock).toHaveBeenCalledWith("Couldn't update follow — please try again.")
    })
  })
})
```

In src/components/home/next-drop-card.test.tsx, replace the two obsolete CTA tests with:

```tsx
it('shows a truthful follow CTA when the event has a group', () => {
  render(<NextDropCard event={makeEvent()} isAuthed isFollowing={false} />)
  const follow = screen.getByRole('button', { name: 'Follow' })
  expect(follow).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByText(/notify/i)).not.toBeInTheDocument()
})

it('shows a pressed Following button instead of a notification-settings link', () => {
  render(<NextDropCard event={makeEvent()} isAuthed isFollowing />)
  const following = screen.getByRole('button', { name: 'Following' })
  expect(following).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('link', { name: /notify/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- src/components/home/notify-cta.test.tsx src/components/home/next-drop-card.test.tsx
```

Expected: FAIL because the current component renders Notify me / Notify is on, the followed state is a link, follow cannot toggle back to unfollow, and mutation failure has no toast.

- [ ] **Step 3: Implement the minimal truthful CTA**

Replace src/components/home/notify-cta.tsx with:

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import Link from 'next/link'
import { HeartIcon } from 'lucide-react'
import { toast } from 'sonner'
import { toggleFollow } from '@/lib/follows/actions'
import { cn } from '@/lib/utils'

// CTA du hero NEXT UP : suivre le groupe uniquement. Les permissions, abonnements
// et préférences push restent une capacité séparée dans Account.
export function NotifyCta({
  groupId,
  initialFollowing,
  isAuthed,
}: {
  groupId: string
  initialFollowing: boolean
  isAuthed: boolean
}) {
  const [optimistic, setOptimistic] = useOptimistic(initialFollowing)
  const [pending, startTransition] = useTransition()

  const pillClass = cn(
    'label-data-inline inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[9px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
    optimistic
      ? 'border-primary/40 text-primary border bg-transparent'
      : 'bg-foreground text-background',
  )

  if (!isAuthed) {
    return (
      <Link href="/login" className={pillClass}>
        <HeartIcon className="size-3" aria-hidden />
        Follow
      </Link>
    )
  }

  function onClick() {
    const wasFollowing = optimistic

    startTransition(async () => {
      setOptimistic(!wasFollowing)
      try {
        await toggleFollow(groupId, wasFollowing)
      } catch {
        toast.error("Couldn't update follow — please try again.")
      }
    })
  }

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={optimistic}
      onClick={onClick}
      className={cn(pillClass, 'disabled:opacity-60')}
    >
      <HeartIcon className={cn('size-3', optimistic && 'fill-current')} aria-hidden />
      {optimistic ? 'Following' : 'Follow'}
    </button>
  )
}
```

Do not modify src/lib/follows/actions.ts or add client refresh logic.

- [ ] **Step 4: Run the focused tests and verify GREEN**

```powershell
npm.cmd test -- src/components/home/notify-cta.test.tsx src/components/home/next-drop-card.test.tsx
```

Expected: both test files PASS with zero failed tests and no React transition warning.

- [ ] **Step 5: Verify the false notification copy is gone**

```powershell
rg -n "Notify me|Notify is on" src/components src/app
```

Expected: no output; rg exits with code 1.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- src/components/home/notify-cta.tsx src/components/home/notify-cta.test.tsx src/components/home/next-drop-card.test.tsx
git commit -m "fix: make hero CTA a real follow control"
```

---

### Task 2: Enforce hero launch scope while preserving legacy rendering

**Files:**

- Create: src/lib/events/hero.ts
- Create: src/lib/events/hero.test.ts
- Modify: src/app/(home)/page.tsx
- Modify: src/components/home/type-badge.test.tsx

**Interfaces:**

- Produces: findHeroEventIndex(events: readonly { type: EventType }[]): number.
- Returns the first mv, release, or music_show index; returns -1 when none is eligible.
- Does not reject or mutate legacy events; it only controls hero placement.

- [ ] **Step 1: Write the failing selector tests and compatibility guard**

Create src/lib/events/hero.test.ts:

```ts
import { describe, expect, it } from 'vitest'
import { findHeroEventIndex } from './hero'

describe('findHeroEventIndex', () => {
  it.each(['mv', 'release', 'music_show'] as const)('accepts %s as a hero event', (type) => {
    expect(findHeroEventIndex([{ type }])).toBe(0)
  })

  it('skips live and anniversary rows in favor of the next real comeback', () => {
    expect(
      findHeroEventIndex([{ type: 'live' }, { type: 'anniversary' }, { type: 'release' }]),
    ).toBe(2)
  })

  it('returns -1 when every event is outside hero scope', () => {
    expect(
      findHeroEventIndex([
        { type: 'live' },
        { type: 'anniversary' },
        { type: 'concert' },
        { type: 'other' },
      ]),
    ).toBe(-1)
  })
})
```

Add to src/components/home/type-badge.test.tsx:

```tsx
it('still renders the legacy live label', () => {
  render(<TypeBadge type="live" />)
  expect(screen.getByText('Live')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run the focused tests and verify RED**

```powershell
npm.cmd test -- src/lib/events/hero.test.ts src/components/home/type-badge.test.tsx
```

Expected: FAIL because src/lib/events/hero.ts does not exist. The legacy assertion already passes.

- [ ] **Step 3: Implement and consume the selector**

Create src/lib/events/hero.ts:

```ts
import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']
type HeroCandidate = { type: EventType }

const HERO_EVENT_TYPES = new Set<EventType>(['mv', 'release', 'music_show'])

export function findHeroEventIndex(events: readonly HeroCandidate[]): number {
  return events.findIndex((event) => HERO_EVENT_TYPES.has(event.type))
}
```

In src/app/(home)/page.tsx:

1. Delete the local COMEBACK_TYPES constant.
2. Add:

```ts
import { findHeroEventIndex } from '@/lib/events/hero'
```

3. Replace the findIndex call with:

```ts
const heroIdx = findHeroEventIndex(merged)
```

4. Use this adjacent comment:

```ts
// Hero = prochain vrai comeback (MV, release ou music show). Les anniversaires
// et les données live héritées restent disponibles dans les autres surfaces.
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

```powershell
npm.cmd test -- src/lib/events/hero.test.ts src/components/home/type-badge.test.tsx
```

Expected: both files PASS; release is selected at index 2 and TypeBadge still renders Live.

- [ ] **Step 5: Verify page wiring**

```powershell
rg -n "COMEBACK_TYPES|findHeroEventIndex" "src/app/(home)/page.tsx" src/lib/events/hero.ts
```

Expected: findHeroEventIndex appears in the helper and page; COMEBACK_TYPES has no match.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- "src/app/(home)/page.tsx" src/lib/events/hero.ts src/lib/events/hero.test.ts src/components/home/type-badge.test.tsx
git commit -m "fix: keep live events out of the home hero"
```

---

### Task 3: Remove live events from visible notification preferences

**Files:**

- Create: src/components/notifications/notification-prefs.test.tsx
- Modify: src/components/notifications/notification-prefs.tsx
- Modify: src/lib/notifications/actions.ts

**Interfaces:**

- Visible rows remain mv, release, music_show, and anniversary.
- Existing stored live preference rows remain readable.
- The Server Action continues accepting live only for old callers/internal compatibility.

- [ ] **Step 1: Add the failing visible-category test**

Create src/components/notifications/notification-prefs.test.tsx:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/notifications/actions', () => ({ setNotificationPref: vi.fn() }))
vi.mock('@/lib/notifications/subscribe', () => ({
  getExistingSubscription: vi.fn(() => new Promise(() => {})),
}))

import { NotificationPrefs } from './notification-prefs'

describe('NotificationPrefs', () => {
  it('shows only launch-supported event categories', () => {
    render(
      <NotificationPrefs
        initial={{ mv: true, release: true, music_show: true, anniversary: true, live: true }}
      />,
    )

    for (const label of ['MV drops', 'Releases', 'Music shows', 'Birthdays & anniversaries']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText('Lives')).not.toBeInTheDocument()
    expect(screen.queryByText(/scheduled premieres and lives/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npm.cmd test -- src/components/notifications/notification-prefs.test.tsx
```

Expected: FAIL because the current component renders Lives.

- [ ] **Step 3: Remove only the public row and correct comments**

Make PREF_ROWS in src/components/notifications/notification-prefs.tsx exactly:

```tsx
const PREF_ROWS = [
  { type: 'mv', label: 'MV drops', hint: 'New music videos from your groups' },
  { type: 'release', label: 'Releases', hint: 'Album & single release dates' },
  { type: 'music_show', label: 'Music shows', hint: 'Music Bank, Inkigayo… lineups' },
  { type: 'anniversary', label: 'Birthdays & anniversaries', hint: 'Member birthdays, debut days' },
] as const
```

Replace the stale five-toggle comment with:

```ts
// Sans abonnement push, ces préférences n'ont aucun effet : les manipuler
// donnerait l'impression que « rien ne marche ».
```

In src/lib/notifications/actions.ts, keep the runtime list and use:

```ts
// Types acceptés par l'action. L'UI expose les quatre catégories du lancement ;
// live reste accepté pour les anciennes préférences et la compatibilité interne.
const PREF_TYPES = ['mv', 'release', 'music_show', 'anniversary', 'live'] as const
```

- [ ] **Step 4: Run the focused test and verify GREEN**

```powershell
npm.cmd test -- src/components/notifications/notification-prefs.test.tsx
```

Expected: PASS with four supported labels and no Lives row.

- [ ] **Step 5: Verify removal and compatibility**

```powershell
rg -n -i "type:\s*'live'.*label:\s*'Lives'|scheduled premieres and lives" src/components/notifications
rg -n -F "'live'" src/lib/notifications/actions.ts
```

Expected: the first command has no output and exits 1; the second retains one PREF_TYPES hit.

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- src/components/notifications/notification-prefs.tsx src/components/notifications/notification-prefs.test.tsx src/lib/notifications/actions.ts
git commit -m "fix: align notification preferences with launch scope"
```

---

### Task 4: Align public copy and active documentation

**Files:**

- Create: tests/contracts/public-copy.test.ts
- Modify: README.md
- Modify: src/app/layout.tsx
- Modify: public/manifest.webmanifest
- Modify: src/app/about/page.tsx
- Modify: src/lib/email/resend.ts
- Modify: docs/KSTAGE_BRIEF.md
- Modify: docs/PROJECT.md

**Interfaces:**

- Public English description: “Your k-pop calendar — releases, music videos, music shows, birthdays, and debut anniversaries.”
- Compatibility notes may mention live only to say it is internal, historical, or outside launch scope.

- [ ] **Step 1: Add the failing public-copy contract test**

Create tests/contracts/public-copy.test.ts:

```ts
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
```

- [ ] **Step 2: Run the contract test and verify RED**

```powershell
npm.cmd test -- tests/contracts/public-copy.test.ts
```

Expected: FAIL for the README, brief, project scope, manifest, layout, About page, and welcome email. Notification preferences already pass after Task 3.

- [ ] **Step 3: Replace user-facing English claims**

Use these exact replacements.

README.md opening:

```md
# KStage

The personal k-pop calendar. Follow your favorite groups and see their releases,
music videos, music shows, birthdays, and debut anniversaries in one place — with
optional push notifications, in your own timezone.
```

Keep “Mobile-first PWA. Live: https://kstage.vercel.app” unchanged.

src/app/layout.tsx:

```ts
const SITE_DESCRIPTION =
  'Your k-pop calendar — releases, music videos, music shows, birthdays, and debut anniversaries.'
```

public/manifest.webmanifest:

```json
  "description": "Your k-pop calendar — releases, music videos, music shows, birthdays, and debut anniversaries.",
```

First paragraph of src/app/about/page.tsx:

```tsx
<p>
  KStage is an independent k-pop calendar that tracks releases, music videos, music shows,
  birthdays, and debut anniversaries — so you never miss a drop from the groups you follow.
</p>
```

Product sentence inside src/lib/email/resend.ts:

```html
<p style="margin:0 0 12px;">
  Your account is active. KStage is your k-pop calendar — releases, music videos, music shows,
  birthdays, and debut anniversaries, all in one place.
</p>
```

- [ ] **Step 4: Align the active product documents**

In docs/KSTAGE_BRIEF.md, replace the one-sentence pitch with:

```md
**« Google Calendar conçu pour les fans de k-pop »** : une PWA mobile-first où le fan suit ses groupes favoris, et l'app filtre tout le reste, lui montre les événements à venir (sorties, MVs, music shows, anniversaires de membres et de début) et le notifie au bon moment dans son fuseau horaire.
```

In docs/PROJECT.md, replace the launch list with:

```md
### Types d'events couverts au lancement

1. **Releases** (albums, singles) — _essentiel_
2. **Music videos** — _essentiel_
3. **Music shows** (M Countdown, Music Bank, Show Champion, Inkigayo, Music Core, The Show) — _essentiel, gros volume hebdo_
4. **Anniversaires** (dates de début et anniversaires des membres)

Hors scope du lancement : événements live, concerts, fanmeetings, tournées, variety shows, award shows et sub-units. Le type interne live reste conservé pour les données historiques.
```

Correct the enum line:

```md
Enums : event_type (mv | release | music_show | live | anniversary | concert | other)
```

Replace the old Lives source section with:

```md
### Événements live — compatibilité historique

- Le type live reste lisible pour les anciennes données, mais n'est ni filtrable ni présenté comme une catégorie du lancement.
- Les métadonnées YouTube liveBroadcastContent et scheduledStartTime restent utilisées pour distinguer une premiere programmée d'une vidéo déjà publiée.
- Aucune ingestion Weverse Live n'est prévue pour la bêta.
```

Replace the combined roadmap bullet with:

```md
- **Music shows** : agrégateur + sources diffuseurs pour les 6 émissions suivies. ✅ **DONE & mergé.**
- **Événements live (Weverse)** : retirés du scope du lancement ; compatibilité interne uniquement, sans promesse d'ingestion.
```

Replace the final sentence of roadmap item 8 with:

```md
La contribution couvre les catégories du lancement ; les suggestions live restent rejetées par la validation.
```

- [ ] **Step 5: Run the contract test and verify GREEN**

```powershell
npm.cmd test -- tests/contracts/public-copy.test.ts
```

Expected: all parameterized file checks PASS.

- [ ] **Step 6: Run focused negative and positive audits**

```powershell
rg -n -i "(comebacks?|music shows?|music videos?|anniversar(y|ies)|releases?|events).{0,100}\blives?\b|\blives?\b.{0,100}(comebacks?|music shows?|music videos?|anniversar(y|ies)|releases?|events)|scheduled premieres and lives" README.md docs/KSTAGE_BRIEF.md public/manifest.webmanifest src/app/layout.tsx src/app/about/page.tsx src/lib/email/resend.ts src/components/notifications/notification-prefs.tsx
rg -n -i -e "Lives officiels" -e "^### Lives" -e "Couvre aussi.*lives" docs/PROJECT.md
```

Expected: both commands have no output and exit 1.

```powershell
rg -n -F -e '"live"' -e "'live'" src/types/database.ts supabase/migrations/0001_init.sql supabase/migrations/0005_taxonomy.sql src/lib/events/labels.ts src/lib/events/href.ts src/lib/scrapers/youtube.ts
```

Expected: compatibility hits remain.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- README.md docs/KSTAGE_BRIEF.md docs/PROJECT.md public/manifest.webmanifest src/app/layout.tsx src/app/about/page.tsx src/lib/email/resend.ts tests/contracts/public-copy.test.ts
git commit -m "docs: align public copy with beta scope"
```

---

### Task 5: Run the full release gate and review the integrated diff

**Files:**

- Verify only; no planned file mutation.

**Interfaces:**

- Consumes the four independently committed tasks.
- Produces fresh evidence for tests, static analysis, build, public smoke behavior, scope boundaries, and a clean feature diff.

- [ ] **Step 1: Run all focused regression tests**

```powershell
npm.cmd test -- src/components/home/notify-cta.test.tsx src/components/home/next-drop-card.test.tsx src/lib/events/hero.test.ts src/components/home/type-badge.test.tsx src/components/notifications/notification-prefs.test.tsx tests/contracts/public-copy.test.ts
```

Expected: every listed file PASS with zero failed tests and no React act or transition warning.

- [ ] **Step 2: Run the complete unit suite**

```powershell
npm.cmd test
```

Expected: exit code 0 and zero failed Vitest tests.

- [ ] **Step 3: Run static quality gates**

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run format:check
```

Expected: all three commands exit 0 with no TypeScript, ESLint, accessibility, or Prettier error.

- [ ] **Step 4: Run the production build**

```powershell
npm.cmd run build
```

Expected: exit code 0 and a completed Next.js 16 production build.

- [ ] **Step 5: Run the public Chromium smoke path**

Do not run authenticated Playwright tests against the personal E2E_AUTH_EMAIL account.

```powershell
npm.cmd test:e2e -- tests/e2e/smoke.spec.ts --project=chromium
```

Expected: Chromium smoke tests PASS. “Events tracked live” stays because it describes freshness.

- [ ] **Step 6: Audit forbidden claims and retained compatibility**

```powershell
rg -n "Notify me|Notify is on|type:\s*'live'.*label:\s*'Lives'|COMEBACK_TYPES.*live" src README.md public docs/PROJECT.md docs/KSTAGE_BRIEF.md
```

Expected: no output; rg exits 1.

```powershell
rg -n -F -e '"live"' -e "'live'" src/types/database.ts supabase/migrations/0001_init.sql supabase/migrations/0005_taxonomy.sql src/lib/events/labels.ts src/lib/events/href.ts src/lib/scrapers/youtube.ts
```

Expected: legacy compatibility hits remain.

- [ ] **Step 7: Review branch scope and whitespace**

```powershell
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short
```

Expected:

- git diff --check exits 0.
- The diff contains only the specification, this plan, and Task 1–4 files.
- The isolated worktree has no unstaged or untracked implementation file.
- The original workspace's untracked output/ audit artifacts are not present in any commit.

- [ ] **Step 8: Request two-stage code review**

Use superpowers:requesting-code-review after fresh verification:

1. Review spec compliance line by line.
2. Review implementation quality, security, accessibility, test reliability, and scope containment.
3. Resolve every confirmed issue with a new RED/GREEN cycle and rerun the affected gate.

## Execution Choice

The user explicitly delegated implementation decisions. Use **Subagent-Driven execution**, the recommended option: one fresh implementation agent per task, followed by specification and code-quality reviews before moving to the next task. Do not reuse the audit agents as implementers.
