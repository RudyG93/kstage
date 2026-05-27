# Refonte home — layout 3 colonnes (HLTV/RFT/VLR-style)

> Plan d'implémentation. Contexte produit : `docs/PROJECT.md` §10 (vision V2, design data-forward).
> Décisions de design validées avec l'user le 2026-05-27. Source du mock visuel : prompt v0 (zip externe, **non versionné**).

---

## Protocole d'exécution (pour l'agent)

**Une étape = un message agent = un commit.** Ne JAMAIS enchaîner plusieurs étapes en une seule passe : la review devient impossible et les régressions invisibles.

Pour chaque étape :

1. Lire la section "Étape N" ci-dessous **en entier** avant d'écrire du code.
2. Exécuter strictement les modifications décrites — ne pas inventer de fichiers supplémentaires, ne pas refactor ce qui n'est pas demandé.
3. Lancer la **validation** indiquée à la fin de l'étape (typecheck + lint + build au minimum).
4. Si la validation échoue : corriger jusqu'à ce qu'elle passe. Ne pas demander à l'user.
5. Faire le commit avec le message exact donné à la fin de l'étape.
6. **Stop.** Rendre la main à l'user pour qu'il review le diff et lance l'étape suivante.

Sortie attendue à la fin de chaque étape : un récap court (3-5 lignes) listant les fichiers touchés + le résultat des commandes de validation.

---

## Contexte et scope

### Constat

La home actuelle (`src/app/page.tsx` vue connectée) est mobile-first monocolonne avec `max-w-2xl` global dans `src/app/layout.tsx`. On bascule vers un **layout 3 colonnes desktop / stack mobile** inspiré de hltv.org, rft.gg, vlr.gg.

### Scope verrouillé

**In** :

- Nouvelle home connectée (3 colonnes desktop, stack mobile)
- Refonte du header (avatar + dropdown, plus d'email visible)
- Couleurs par type d'event (badges, barres, dots) + couleurs groupes (avatars/pastilles uniquement)
- Blocs droite : MV/Release of the month + Recent activity = **mockés clairement** (V2 ratings, cf. `PROJECT.md` §10)
- Recent comebacks + Community pulse = **vraies données** (déjà en DB)

**Out (V2 ou autres étapes)** :

- Table `profiles` + avatar upload (page `/account` créée mais vide)
- Système de votes / ratings (table à designer plus tard)
- Pages d'articles commentaires/votes des MV
- Modification de la `Landing` (vue déconnectée) — reste inchangée
- Modification de `/calendar`, `/groups`, `/my`, `/login`, `/signup`, `/suggest`, `/admin/suggestions` — leur contenu reste identique, seul leur wrapper de largeur change (étape 1)

### Règles spécifiques à cette refonte (en plus de `CLAUDE.md`)

- **shadcn = `base-nova` / `@base-ui/react`. JAMAIS `asChild`.** Utiliser `render={<Element />}` pour rendre un autre tag. Vérifier le pattern dans `src/components/ui/dialog.tsx` (`<DialogPrimitive.Close render={<Button … />}>`).
- **RSC par défaut.** `'use client'` UNIQUEMENT pour les composants qui ont besoin de `useState`, `useEffect`, `onClick`, ou `useSearchParams` côté client.
- **Réutiliser obligatoirement les helpers existants** : `kstDayKey`, `kstToUtcISO`, `groupEventsByKstDay`, `splitUpcomingByWeek` (`src/lib/events/date.ts`, `src/lib/events/grouping.ts`), `LocalTime` (`src/components/local-time.tsx`), `formatEventDate`, et le composant `FilterBar` (`src/components/filter-bar.tsx`) comme référence pour la logique de filtres URL.
- **Filtres via URL search params**, jamais `useState` local (pattern déjà en place dans `FilterBar`).
- **`next/image` obligatoire**, jamais `<img>`.
- Pas d'emoji.
- Mock visuel v0 = référence visuelle uniquement, jamais copier-coller du code v0 dans le projet.

### Couleurs verrouillées

Par **type d'event** (badges, barres latérales, dots de filtres, halos hover) :

- `comeback` → `#ff5ca8`
- `music_show` → `#f5c542`
- `live` → `#5bc0ff`
- `anniversary` → `#cdb4ff`
- `concert`, `other` → `#9aa0a6` (gris neutre, ces types ne sont pas filtrables au MVP)

Par **groupe** (pastilles, dots, avatars fallback uniquement) :

- aespa `#FF1B6B` · ILLIT `#F5C6D6` · BABYMONSTER `#F2A900` · i-dle `#D4145A`
  (déjà dans `groups.color_hex` en DB)

**Gradient signature** `linear-gradient(135deg, #8b5cff 0%, #ff2d87 100%)` : wordmark KStage, CTAs primaires (`Sign up`), badges "of the month", avatars fallback. Jamais en background plein de zone large.

---

## Étape 0 — Tokens & config

### Objectif

Préparer les utilities CSS, la map de couleurs par type, et les domaines images autorisés.

### Fichiers

- **Modifier** `src/app/globals.css` : ajouter EN FIN DE FICHIER (après le bloc `@layer base` existant), un nouveau bloc :

  ```css
  @layer utilities {
    .gradient-text {
      background: linear-gradient(135deg, #8b5cff 0%, #ff2d87 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .gradient-signature {
      background: linear-gradient(135deg, #8b5cff 0%, #ff2d87 100%);
    }
  }
  ```

  Ne RIEN modifier d'autre dans ce fichier (les tokens OKLCH, le `@theme inline`, le `body` halos sont déjà OK).

- **Modifier** `src/lib/events/labels.ts` : ajouter SOUS `EVENT_TYPE_LABELS` :

  ```ts
  export const EVENT_TYPE_COLORS: Record<EventType, string> = {
    comeback: '#ff5ca8',
    music_show: '#f5c542',
    live: '#5bc0ff',
    anniversary: '#cdb4ff',
    concert: '#9aa0a6',
    other: '#9aa0a6',
  }
  ```

- **Modifier** `next.config.ts` : ajouter la config `images.remotePatterns` pour autoriser `picsum.photos` (placeholders mocks), `i.ytimg.com` (thumbs YouTube), `kpopofficial.com` (covers comebacks scrapées) :
  ```ts
  const nextConfig: NextConfig = {
    images: {
      remotePatterns: [
        { protocol: 'https', hostname: 'picsum.photos' },
        { protocol: 'https', hostname: 'i.ytimg.com' },
        { protocol: 'https', hostname: 'kpopofficial.com' },
      ],
    },
  }
  ```

### Validation

```bash
npm run typecheck && npm run lint && npm run build
```

Tout doit passer. Aucun changement visuel encore.

### Commit

```
chore(home): add gradient utilities, event type colors, image domains
```

---

## Étape 1 — Libérer le layout global

### Objectif

Retirer la contrainte `max-w-2xl` du `<main>` global pour que la home puisse être large (1400px). Les autres pages doivent garder leur largeur actuelle via un wrapper local.

### Fichiers

- **Modifier** `src/app/layout.tsx` : remplacer la classe du `<main>` :

  ```diff
  - <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 pb-24 md:pb-6">
  + <main className="flex-1 pb-24 md:pb-6">
  ```

- **Modifier** chacune des pages suivantes pour wrapper leur contenu actuel dans `<div className="mx-auto w-full max-w-2xl px-4 py-6">…</div>` :
  - `src/app/calendar/page.tsx`
  - `src/app/groups/page.tsx`
  - `src/app/groups/[slug]/page.tsx`
  - `src/app/login/page.tsx`
  - `src/app/signup/page.tsx`
  - `src/app/my/page.tsx`
  - `src/app/suggest/page.tsx`
  - `src/app/admin/suggestions/page.tsx`

- **Modifier** `src/app/page.tsx` : la branche `if (!user) return <Landing groups={groups} />` doit aussi être wrappée. Soit dans la page (`return <div className="mx-auto w-full max-w-2xl px-4 py-6"><Landing … /></div>`), soit en wrappant `<Landing>` côté composant — choisir la solution qui touche le moins de fichiers (privilégier le wrap dans `page.tsx`).

- **Modifier** `src/app/loading.tsx` : wrapper aussi en `max-w-2xl px-4 py-6` pour cohérence pendant les transitions.

- **Modifier** `src/app/error.tsx` : idem.

### Validation

```bash
npm run typecheck && npm run lint && npm run build && npm run test:e2e
```

Test manuel `npm run dev` : `/login`, `/signup`, `/groups`, `/calendar`, `/my`, `/suggest` doivent avoir un rendu **strictement identique** à avant (centré max-w-2xl). La home déconnectée (`/`) aussi.

### Commit

```
refactor(layout): move max-w-2xl from global main to per-page wrappers
```

---

## Étape 2 — Header avatar + dropdown

### Objectif

Remplacer "email + bouton Sign out" par un **avatar cliquable** qui ouvre un dropdown `{ Account settings, Sign out }`. Si non connecté : 2 boutons `Log in` (ghost) + `Sign up` (gradient).

### Contraintes spécifiques

- DropdownMenu est en `@base-ui/react/menu`. **Pas de `asChild`**, utiliser `render={<Element />}`.
- Avatar fallback (pas d'image en DB au MVP, table `profiles` à venir post-launch) = initiales extraites de l'email (partie avant `@`, max 2 caractères, uppercase) sur fond `gradient-signature`.
- Le menu a EXACTEMENT 2 items : `Account settings` (Link vers `/account`, page pas encore créée — c'est OK, le lien renverra 404 temporairement) + `Sign out` (server action `signOut` existante).
- **Pas d'email visible** dans le header.

### Fichiers

- **Créer** `src/components/avatar.tsx` (RSC) :

  ```tsx
  function getInitials(email: string): string {
    const local = email.split('@')[0] ?? ''
    return local.slice(0, 2).toUpperCase()
  }

  export function Avatar({ email, size = 32 }: { email: string; size?: number }) {
    return (
      <div
        className="gradient-signature flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        aria-hidden
      >
        {getInitials(email)}
      </div>
    )
  }
  ```

- **Modifier** `src/components/auth/auth-menu.tsx` :
  - Si `email === null` : rendre 2 éléments côte à côte :
    - `<Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Log in</Link>`
    - `<Link href="/signup" className="gradient-signature inline-flex h-7 items-center rounded-md px-3 text-sm font-medium text-white">Sign up</Link>`
  - Si `email !== null` :
    ```tsx
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
          />
        }
      >
        <Avatar email={email} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem render={<Link href="/account" />}>
          <Settings className="size-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut} className="contents">
          <DropdownMenuItem render={<button type="submit" />}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
    ```
  - Imports nécessaires : `Link` (next/link), `Settings`, `LogOut` (lucide-react), `Avatar` (./avatar ou le bon chemin), `DropdownMenu*` (depuis `@/components/ui/dropdown-menu`), `signOut` (depuis `@/lib/auth/actions`), `buttonVariants`.

- **Ne pas toucher** à `src/app/layout.tsx` — la prop `email` du `<AuthMenu>` est déjà passée correctement.

### Validation

```bash
npm run typecheck && npm run lint && npm run build && npm run test:e2e
```

Le test E2E `auth.spec.ts` cherche `getByRole('button', { name: 'Sign out' })` — toujours valide car le `DropdownMenuItem` render avec `<button type="submit">` reste un bouton ARIA "Sign out".

Test manuel : clic sur l'avatar → menu s'ouvre avec 2 items. Clic sur "Sign out" → déconnecte et redirige vers `/`. Clic sur "Account settings" → 404 (normal, page pas créée).

### Commit

```
feat(header): replace email/signout with avatar dropdown
```

---

## Étape 3 — Shell 3 colonnes (vide)

### Objectif

Remplacer la vue connectée de `src/app/page.tsx` par un shell 3 colonnes vide avec 3 placeholders. Pas encore de vraie donnée — on valide la structure et le responsive.

### Fichiers

- **Modifier** `src/app/page.tsx`. La branche connectée (après `if (!user) return <Landing …/>`) devient :
  ```tsx
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6">
      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="order-2 shrink-0 lg:order-1 lg:w-60">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Sidebar left (TODO)
          </div>
        </aside>
        <main className="order-1 min-w-0 flex-1 lg:order-2">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Center feed (TODO)
          </div>
        </main>
        <aside className="order-3 shrink-0 lg:w-80">
          <div className="text-muted-foreground rounded-xl border p-4 text-sm">
            Sidebar right (TODO)
          </div>
        </aside>
      </div>
    </div>
  )
  ```
- Retirer les imports devenus inutiles de la branche connectée (`FilterBar`, `GroupedEventList`, `getUpcomingEvents`, `searchParams` côté connecté). La `Landing` reste intacte (branche déconnectée).
- Si `searchParams` n'est plus utilisé du tout, retirer la prop de la signature de `Home`.

### Validation

```bash
npm run typecheck && npm run lint && npm run build
```

Test manuel `npm run dev` connecté : `/` affiche 3 boîtes vides en colonnes desktop (≥ 1024px), en pile mobile (center → right → left). Tester aussi 768px (tablette = stack) et 1280/1440 (desktop = 3 colonnes).

### Commit

```
feat(home): scaffold 3-column shell
```

---

## Étape 4 — Sidebar gauche (vraies données)

### Objectif

Implémenter `<SidebarLeft>` avec 3 blocs : My groups (vraies données) + Filters (types) + Stats.

### Fichiers

- **Créer** `src/lib/events/queries.ts` — ajouter une nouvelle fonction (après `getEventsForMonth`) :

  ```ts
  export async function getUpcomingEventCountsByGroup(
    groupIds: string[],
  ): Promise<Map<string, number>> {
    if (groupIds.length === 0) return new Map()
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('group_id')
      .in('group_id', groupIds)
      .gte('start_at', new Date().toISOString())
    if (error) throw error
    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1)
    }
    return counts
  }
  ```

- **Créer** `src/components/home/type-filter-vertical.tsx` (`'use client'`) — variante verticale du filtre par type, lit/écrit dans les search params (même pattern que `FilterBar`) :

  ```tsx
  'use client'
  import { usePathname, useRouter, useSearchParams } from 'next/navigation'
  import { EVENT_TYPE_LABELS, EVENT_TYPE_COLORS, FILTERABLE_EVENT_TYPES } from '@/lib/events/labels'
  import { cn } from '@/lib/utils'

  export function TypeFilterVertical() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const current = searchParams.get('type') ?? ''

    function setType(value: string) {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== current) params.set('type', value)
      else params.delete('type')
      const qs = params.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    }

    return (
      <div className="space-y-1">
        {FILTERABLE_EVENT_TYPES.map((t) => {
          const active = current === t
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={active}
              className={cn(
                'flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-200',
                active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/40',
              )}
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: EVENT_TYPE_COLORS[t] }}
              />
              {EVENT_TYPE_LABELS[t]}
            </button>
          )
        })}
      </div>
    )
  }
  ```

- **Créer** `src/components/home/sidebar-left.tsx` (RSC). Signature :

  ```tsx
  export async function SidebarLeft() { … }
  ```

  Récupère :
  - `const followedIds = await getFollowedGroupIds()`
  - `const groups = await getGroups()` filtrés à `followedIds`
  - `const counts = await getUpcomingEventCountsByGroup([...followedIds])`
  - `const totalUpcoming = [...counts.values()].reduce((a, b) => a + b, 0)`

  Rendu (3 sections en `space-y-6`, dans un wrapper `<div className="lg:sticky lg:top-20">`) :
  1. Card "My groups" `<div className="bg-card ring-1 ring-foreground/10 rounded-xl p-4">` :
     - Header : `<span className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground">MY GROUPS</span>` + `<Link href="/groups" className="text-xs text-muted-foreground hover:text-foreground">manage</Link>` (`flex items-center justify-between mb-3`).
     - Si liste vide : un message court + Link "Browse groups".
     - Sinon : liste de `<Link href={\`/groups/${group.slug}\`}>`h-10 avec dot 10px (color_hex), nom (flex-1 truncate font-medium text-sm), compteur en font-mono tabular-nums`· {count}`. Hover `bg-muted/40`.

  2. Card "Filters" : header `FILTERS` + `<TypeFilterVertical />`.

  3. Bloc stats (pas de card, `px-2`) : `<p className="text-xs font-mono text-muted-foreground">{groups.length} groups · {totalUpcoming} upcoming</p>`.

- **Modifier** `src/app/page.tsx` : remplacer le placeholder gauche par `<SidebarLeft />`. Conserver les placeholders centre + droite pour l'instant.

### Validation

```bash
npm run typecheck && npm run lint && npm run build && npm run test:e2e
```

Test manuel : groupes suivis affichés avec leurs comptes corrects. Clic sur un filtre type → URL change. Responsive : la sidebar passe en bas de la stack mobile (ordre 2 du shell).

### Commit

```
feat(home): sidebar left with my groups, type filters, stats
```

---

## Étape 5 — Next drop card (centre)

### Objectif

Hero card centrale qui affiche le prochain event avec compte-à-rebours.

### Fichiers

- **Créer** `src/components/home/type-badge.tsx` (RSC) :

  ```tsx
  import { EVENT_TYPE_COLORS, EVENT_TYPE_LABELS } from '@/lib/events/labels'
  import type { Database } from '@/types/database'

  type EventType = Database['public']['Enums']['event_type']

  export function TypeBadge({ type }: { type: EventType }) {
    const color = EVENT_TYPE_COLORS[type]
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        {EVENT_TYPE_LABELS[type]}
      </span>
    )
  }
  ```

- **Créer** `src/components/home/countdown.tsx` (`'use client'`) :
  - Props : `{ targetIso: string }`
  - `useState` + `useEffect` avec `setInterval(60_000)` qui calcule `days/hours/minutes` vers `targetIso`.
  - Pendant l'hydratation (server render), rendre `"--d --h --m"` pour éviter le mismatch.
  - Utiliser `useHydrated()` (existe déjà dans `src/hooks/use-hydrated.ts`).
  - Rendu : `<div className="text-right"><div className="font-mono text-4xl tabular-nums tracking-tight">02d 14h 23m</div><div className="text-muted-foreground mt-1 text-xs">until release</div></div>`.

- **Créer** `src/components/home/next-drop-card.tsx` (RSC) :

  ```tsx
  import Image from 'next/image'
  import { Countdown } from './countdown'
  import { TypeBadge } from './type-badge'
  import type { UpcomingEvent } from '@/lib/events/queries'

  export function NextDropCard({ event }: { event: UpcomingEvent | null }) {
    if (!event) return null
    const group = event.groups
    return (
      <div className="bg-card animate-in fade-in slide-in-from-bottom-2 ring-foreground/10 relative overflow-hidden rounded-2xl p-6 ring-1 duration-500">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, #8b5cff 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, #ff2d87 0%, transparent 50%)',
          }}
          aria-hidden
        />
        <div className="relative flex items-center gap-6">
          {group?.image_url ? (
            <Image
              src={group.image_url}
              alt={group.name}
              width={80}
              height={80}
              className="size-20 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="gradient-signature flex size-20 shrink-0 items-center justify-center rounded-2xl text-2xl font-bold text-white"
              aria-hidden
            >
              {group?.name?.[0] ?? '?'}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <TypeBadge type={event.type} />
            <h2 className="font-heading mt-2 text-2xl font-bold tracking-tight text-balance">
              {event.title}
            </h2>
            <p className="text-muted-foreground mt-1 font-mono text-xs tracking-[0.1em] uppercase">
              {group?.name}
            </p>
          </div>
          <div className="hidden shrink-0 sm:block">
            <Countdown targetIso={event.start_at} />
          </div>
        </div>
        <div className="border-border mt-4 border-t pt-4 sm:hidden">
          <Countdown targetIso={event.start_at} />
        </div>
      </div>
    )
  }
  ```

- **Modifier** `src/app/page.tsx` : avant le `return` connecté, fetch :
  ```ts
  const followedIds = await getFollowedGroupIds()
  const events =
    followedIds.size > 0 ? await getUpcomingEvents({ groupIds: [...followedIds], limit: 50 }) : []
  const nextDrop = events[0] ?? null
  ```
  Passer `nextDrop` à `<NextDropCard event={nextDrop} />`. Garder pour l'instant un placeholder pour la suite du centre.

### Validation

```bash
npm run typecheck && npm run lint && npm run build
```

Test manuel : la card affiche le prochain event du user. Countdown se met à jour chaque minute. Pas de warning de mismatch hydratation dans la console.

### Commit

```
feat(home): next drop card with countdown
```

---

## Étape 6 — This week + Later

### Objectif

Remplacer `GroupedEventList` sur la home par une nouvelle structure visuelle : image groupe + barre couleur par type + groupement par jour KST. (Pas de suppression de `GroupedEventList`, qui reste utilisé sur `/my` et `/groups/[slug]`.)

### Fichiers

- **Créer** `src/components/home/event-card.tsx` (RSC). Deux variantes via prop `compact?: boolean` :

  ```tsx
  import Image from 'next/image'
  import Link from 'next/link'
  import { LocalTime } from '@/components/local-time'
  import { EVENT_TYPE_COLORS } from '@/lib/events/labels'
  import { TypeBadge } from './type-badge'
  import type { UpcomingEvent } from '@/lib/events/queries'

  const kstFormat = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso))

  export function HomeEventCard({
    event,
    compact = false,
  }: {
    event: UpcomingEvent
    compact?: boolean
  }) {
    const group = event.groups
    const color = EVENT_TYPE_COLORS[event.type]
    const kst = kstFormat(event.start_at)

    if (compact) {
      return (
        <Link
          href={`/groups/${group?.slug ?? ''}`}
          className="hover:bg-muted/30 group -mx-3 flex h-14 items-center gap-3 rounded-xl px-3 transition-colors duration-200"
        >
          <div
            className="h-8 w-[3px] shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: group?.color_hex ?? '#888' }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{group?.name}</span>
              <TypeBadge type={event.type} />
            </div>
            <p className="text-muted-foreground truncate text-xs">{event.title}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-sm tabular-nums">{kst} KST</p>
            <p className="text-muted-foreground text-xs">
              <LocalTime iso={event.start_at} />
            </p>
          </div>
        </Link>
      )
    }

    return (
      <Link
        href={`/groups/${group?.slug ?? ''}`}
        className="hover:bg-muted/30 hover:ring-foreground/5 group -mx-3 flex items-center gap-4 rounded-xl p-3 transition-all duration-200 hover:ring-1"
      >
        <div
          className="w-[3px] shrink-0 self-stretch rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
        {group?.image_url ? (
          <Image
            src={group.image_url}
            alt={group.name}
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="gradient-signature flex size-12 shrink-0 items-center justify-center rounded-xl font-semibold text-white"
            aria-hidden
          >
            {group?.name?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{group?.name}</span>
            <TypeBadge type={event.type} />
          </div>
          <p className="text-muted-foreground mt-0.5 truncate text-sm">{event.title}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-sm tabular-nums">{kst} KST</p>
          <p className="text-muted-foreground text-xs">
            <LocalTime iso={event.start_at} />
          </p>
        </div>
      </Link>
    )
  }
  ```

- **Créer** `src/components/home/feed.tsx` (RSC) :
  - Props : `{ events: UpcomingEvent[] }`
  - Utilise `splitUpcomingByWeek(events)` pour découper en `thisWeek` / `later`.
  - Pour chaque bucket non vide :
    - Header section :
      ```tsx
      <div className="mb-4 flex items-center gap-4">
        <span className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          THIS WEEK
        </span>
        <span className="bg-border h-px flex-1" />
      </div>
      ```
    - Group via `groupEventsByKstDay()` (Map<dayKey, Event[]>)
    - Pour chaque jour : mini-header `MON · MAY 26` (format via `Intl.DateTimeFormat` avec `weekday: 'short'`, `month: 'short'`, `day: 'numeric'`, `timeZone: 'Asia/Seoul'`, uppercase, séparé par `· `), puis liste `<HomeEventCard event={…} compact={isLater} />`.
  - Si `events.length === 0` : empty state (réutiliser le style existant de `EventList`).

- **Modifier** `src/app/page.tsx` : passer les events restants (sans le premier qui est dans NextDropCard) au `<Feed events={events.slice(1)} />`. Remplacer le placeholder centre par `<NextDropCard /> + <Feed />` empilés en `space-y-8`.

### Validation

```bash
npm run typecheck && npm run lint && npm run build
```

Test manuel : visuel des cartes propre, dates KST + locales OK, fallback gradient si `image_url` est null (cas des 4 groupes seed actuels). Mobile responsive testé à 375/768.

### Commit

```
feat(home): redesigned feed with this-week / later sections
```

---

## Étape 7 — Sidebar droite (mocks V2 isolés)

### Objectif

Implémenter la sidebar droite. La plupart des blocs sont **mockés** (pas de table `ratings` / `articles` encore — cf. `PROJECT.md` §10). Isoler proprement les mocks pour les wirer plus tard.

### Fichiers

- **Créer** `src/lib/mocks/home.ts` :

  ```ts
  // ⚠️ Mocks isolés — à remplacer par de vraies données quand le système de
  // ratings + articles existera (vision V2, cf. PROJECT.md §10 et BACKLOG.md).
  // Ne pas ajouter de logique métier ici — fixtures statiques uniquement.

  export const MOCK_MV_OF_THE_MONTH = {
    title: 'Whiplash',
    groupName: 'aespa',
    groupSlug: 'aespa',
    thumbnailUrl: 'https://picsum.photos/seed/whiplash-mv/400/225',
    rating: 4.7,
    votes: 1247,
  } as const

  export const MOCK_RELEASE_OF_THE_MONTH = {
    title: 'SUPER REAL ME',
    groupName: 'ILLIT',
    groupSlug: 'illit',
    coverUrl: 'https://picsum.photos/seed/super-real-me/200',
    rating: 4.5,
    votes: 892,
  } as const

  export const MOCK_RECENT_ACTIVITY = [
    { id: 'ra1', title: 'aespa — Whiplash MV', comments: 42, groupColor: '#FF1B6B' },
    { id: 'ra2', title: 'ILLIT — Magnetic MV', comments: 38, groupColor: '#F5C6D6' },
    { id: 'ra3', title: 'BABYMONSTER — SHEESH', comments: 27, groupColor: '#F2A900' },
    { id: 'ra4', title: 'i-dle — Fate MV', comments: 64, groupColor: '#D4145A' },
    { id: 'ra5', title: 'aespa — Supernova MV', comments: 51, groupColor: '#FF1B6B' },
    { id: 'ra6', title: 'ILLIT — Lucky Girl MV', comments: 19, groupColor: '#F5C6D6' },
  ] as const
  ```

- **Ajouter** dans `src/lib/events/queries.ts` :

  ```ts
  export async function getRecentComebacks(limit = 3) {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('events')
      .select('id, title, start_at, image_url, groups!inner(name, slug)')
      .eq('type', 'comeback')
      .lt('start_at', new Date().toISOString())
      .order('start_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data ?? []
  }
  export type RecentComeback = Awaited<ReturnType<typeof getRecentComebacks>>[number]
  ```

- **Créer** `src/components/home/sidebar-right.tsx` (RSC). Structure (cards empilées `space-y-4`) :
  1. **MV of the month** (mock) — card `rounded-2xl bg-card ring-1 ring-foreground/10 overflow-hidden` :
     - `<div className="relative aspect-video">` avec `<Image src={MOCK_MV_OF_THE_MONTH.thumbnailUrl} alt={…} fill className="object-cover" sizes="320px" />`
     - Badge absolute top-3 left-3 : `<span className="gradient-signature rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">MV of the month</span>`
     - En dessous, padding p-4 : titre `font-heading font-bold text-lg`, nom groupe en `font-mono text-xs uppercase text-muted-foreground`, ligne `flex items-center gap-3 mt-3` avec `<Star className="size-4 fill-yellow-500 text-yellow-500" />` + note `text-2xl font-bold tabular-nums` + `1.2k votes` en `font-mono text-muted-foreground text-sm`.

  2. **Release of the month** (mock) — card compact `bg-card ring-1 ring-foreground/10 rounded-xl p-4` avec cover carré `size-16 rounded-xl` à gauche + titre + étoile + note + votes à droite. Badge "Release of the month" en `gradient-text font-bold text-[10px] uppercase tracking-wider`.

  3. **Recent comebacks** (vraie donnée) — card `rounded-xl p-4`, header `SectionLabel "RECENT COMEBACKS"`, liste de `getRecentComebacks(3)` : par item, Link vers `/groups/[slug]` avec cover `size-12 rounded-md` + titre truncate + nom groupe + date courte en font-mono (`{ month: 'short', day: 'numeric' }`).

  4. **Recent activity** (mock) — card `rounded-xl p-4`, header `RECENT ACTIVITY`, liste `MOCK_RECENT_ACTIVITY` en lignes denses h-9 : dot 6px de `groupColor` + titre truncate + count en mono `· {comments}`. Hover `bg-muted/30 rounded-md`. Les Links pointent vers `#` (pages d'articles inexistantes).

  5. **Community pulse** (vraie donnée) — card `rounded-xl p-4` :
     - `const pendingCount = await getPendingSuggestionsCount()` (existe déjà dans `src/lib/suggestions/queries.ts`)
     - Badge ambré `<span className="bg-amber-500/20 text-amber-500 rounded-full px-2 py-0.5 text-xs font-medium">{pendingCount} pending suggestions</span>` (uniquement si `pendingCount > 0`)
     - CTA full-width : `<Link href="/suggest" className={buttonVariants({ variant: 'outline' })}>` + icône `Lightbulb` + "Suggest an event"

  Imports : `Star`, `Lightbulb` (lucide-react), `Image` (next/image), `Link`, `buttonVariants`, mocks + `getRecentComebacks` + `getPendingSuggestionsCount`.

- **Modifier** `src/app/page.tsx` : remplacer le placeholder droit par `<SidebarRight />`.

### Validation

```bash
npm run typecheck && npm run lint && npm run build
```

Test manuel : tous les blocs s'affichent. Le `pendingCount` reflète la vraie DB. Les mocks sont visibles mais clairement à part dans `src/lib/mocks/home.ts`.

### Commit

```
feat(home): right sidebar with V2 mocks isolated
```

---

## Étape 8 — Cleanup, doc, PR

### Objectif

Finaliser, documenter le statut, ouvrir la PR.

### Actions

1. Audit visuel local : ouvrir `npm run dev` et tester à 375 / 768 / 1280 / 1440. Noter les ajustements mineurs (espacements, débordements) et les corriger directement.

2. Run complet :

   ```bash
   npm run format && npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build
   ```

3. **Modifier** `docs/PROJECT.md` §9 (État actuel) : ajouter en haut de la section, après le résumé de l'étape 8 actuelle :

   > Refonte home en layout 3 colonnes (HLTV/RFT-style) mergée. Blocs _MV of the month_, _Release of the month_ et _Recent activity_ mockés isolément dans `src/lib/mocks/home.ts` en attendant le système de ratings + articles (V2, cf. §10).

4. **Modifier** `docs/BACKLOG.md` : ajouter une nouvelle section :

   ```md
   ## Compte utilisateur (post home-redesign)

   - **Table `profiles`** : `id` (= `auth.users.id`), `username` (unique, citext), `avatar_url`. RLS own-rows.
   - **Storage Supabase** : bucket `avatars`, policies upload own.
   - **Page `/account`** : formulaire username + upload avatar. Composant `<Avatar />` à mettre à jour pour préférer `avatar_url` puis fallback initiales.
   - **Migration des initiales** : remplacer la dérivation depuis l'email par le `username` quand présent.

   ## Wiring V2 des mocks home

   - Quand le système de ratings + articles existera, remplacer les imports depuis
     `src/lib/mocks/home.ts` dans `src/components/home/sidebar-right.tsx` par des
     queries réelles (`getMvOfTheMonth`, `getReleaseOfTheMonth`, `getRecentActivity`).
     Supprimer `src/lib/mocks/home.ts` à ce moment-là.
   ```

5. Commit :

   ```
   docs: update project status and backlog post home-redesign
   ```

6. Push de la branche : `git push -u origin feat/home-redesign`.

### Rendu final

Sortie à l'user après l'étape 8 :

- Liste des commits sur la branche (`git log --oneline main..HEAD`)
- Lien (à ouvrir manuellement, l'agent n'a pas accès à `gh` cf. `PROJECT.md` §9) : `https://github.com/RudyG93/kstage/compare/main...feat/home-redesign?expand=1`
- Suggestion de description PR :

  ```
  Refonte de la home en layout 3 colonnes inspiré HLTV / RFT / VLR.

  - Header : avatar + dropdown (Account settings / Sign out), plus d'email visible.
  - Layout : 1400px max, 3 colonnes desktop (sidebar gauche 240px / centre fluide / sidebar droite 320px), stack mobile (centre → droite → gauche).
  - Sidebar gauche : My groups, filtres par type, stats.
  - Centre : Next drop hero + countdown, This week / Later avec image groupe + barre couleur par type.
  - Sidebar droite : MV of the month + Release of the month + Recent activity (mockés V2), Recent comebacks + Community pulse (vraies données).
  - Couleurs par type d'event (badges, barres) distinctes des couleurs par groupe (pastilles/avatars).
  - Pages /calendar, /groups, /login, /signup, /my, /suggest, /admin conservent leur largeur `max-w-2xl` via wrappers locaux.

  Les blocs MV/Release/Recent activity dépendront du système de ratings (V2).
  ```

---

## Liste des fichiers touchés (vue d'ensemble)

**Créés** :

- `src/components/avatar.tsx`
- `src/components/home/sidebar-left.tsx`
- `src/components/home/type-filter-vertical.tsx`
- `src/components/home/type-badge.tsx`
- `src/components/home/countdown.tsx`
- `src/components/home/next-drop-card.tsx`
- `src/components/home/event-card.tsx`
- `src/components/home/feed.tsx`
- `src/components/home/sidebar-right.tsx`
- `src/lib/mocks/home.ts`

**Modifiés** :

- `src/app/globals.css` (utilities gradient)
- `src/app/layout.tsx` (retrait `max-w-2xl` du main)
- `src/app/page.tsx` (refonte vue connectée)
- `src/app/loading.tsx`, `src/app/error.tsx` (wrappers max-w-2xl)
- `src/app/{calendar,groups,groups/[slug],login,signup,my,suggest,admin/suggestions}/page.tsx` (wrappers max-w-2xl)
- `src/components/auth/auth-menu.tsx` (avatar + dropdown)
- `src/lib/events/labels.ts` (EVENT_TYPE_COLORS)
- `src/lib/events/queries.ts` (getUpcomingEventCountsByGroup + getRecentComebacks)
- `next.config.ts` (images remotePatterns)
- `docs/PROJECT.md` (§9)
- `docs/BACKLOG.md`

**Non touchés (à confirmer)** :

- `src/components/landing.tsx` — la vue déconnectée reste inchangée
- `src/components/grouped-event-list.tsx`, `src/components/event-list.tsx`, `src/components/event-card.tsx` (l'ancienne carte plate) — toujours utilisés sur `/my`, `/groups/[slug]`, `/calendar`
- Les tests existants — adaptés uniquement si un sélecteur change (cf. notes par étape)
