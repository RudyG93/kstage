import type { ComponentType, CSSProperties } from 'react'
import {
  SiSpotify,
  SiApplemusic,
  SiYoutubemusic,
  SiDeezer,
  SiTidal,
  SiSoundcloud,
  SiYoutube,
  SiInstagram,
  SiX,
  SiTiktok,
  SiFacebook,
  SiSinaweibo,
} from '@icons-pack/react-simple-icons'

type IconProps = { size?: number; color?: string; className?: string }

// Weverse n'est pas dans @icons-pack/react-simple-icons → icône maison (le « W »
// continu du logo). Même signature que les composants simple-icons (size/color).
function SiWeverse({ size = 18, color = 'currentColor', className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2 5.5 7 18.5 12 8 17 18.5 22 5.5" />
    </svg>
  )
}

type LinkGroup = 'streaming' | 'social'

// Ordre de priorité en mode compact (stats strip) : les réseaux clés d'abord,
// pour qu'ils ne sautent jamais derrière le streaming (R8).
const COMPACT_PRIORITY = [
  'spotify',
  'instagram',
  'youtube',
  'weverse',
  'tiktok',
  'twitter',
  'apple_music',
  'youtube_music',
  'deezer',
  'facebook',
  'tidal',
  'soundcloud',
  'weibo',
]

// Couleur de marque appliquée au survol (§6.3). Par défaut l'icône suit la
// couleur du texte (theme-safe) : les marques quasi-noires (X, TikTok, Tidal)
// resteraient invisibles si on les forçait en permanence sur fond sombre/clair.
const ENTRIES: {
  key: string
  Icon: ComponentType<IconProps>
  label: string
  group: LinkGroup
  brand: string
}[] = [
  { key: 'spotify', Icon: SiSpotify, label: 'Spotify', group: 'streaming', brand: '#1DB954' },
  {
    key: 'apple_music',
    Icon: SiApplemusic,
    label: 'Apple Music',
    group: 'streaming',
    brand: '#FA2D48',
  },
  {
    key: 'youtube_music',
    Icon: SiYoutubemusic,
    label: 'YouTube Music',
    group: 'streaming',
    brand: '#FF0000',
  },
  { key: 'deezer', Icon: SiDeezer, label: 'Deezer', group: 'streaming', brand: '#A238FF' },
  { key: 'tidal', Icon: SiTidal, label: 'Tidal', group: 'streaming', brand: '#38BDF8' },
  {
    key: 'soundcloud',
    Icon: SiSoundcloud,
    label: 'SoundCloud',
    group: 'streaming',
    brand: '#FF5500',
  },
  { key: 'youtube', Icon: SiYoutube, label: 'YouTube', group: 'social', brand: '#FF0000' },
  { key: 'instagram', Icon: SiInstagram, label: 'Instagram', group: 'social', brand: '#E4405F' },
  { key: 'twitter', Icon: SiX, label: 'X', group: 'social', brand: '#1DA1F2' },
  { key: 'tiktok', Icon: SiTiktok, label: 'TikTok', group: 'social', brand: '#25F4EE' },
  { key: 'weverse', Icon: SiWeverse, label: 'Weverse', group: 'social', brand: '#4B7BFF' },
  { key: 'facebook', Icon: SiFacebook, label: 'Facebook', group: 'social', brand: '#1877F2' },
  { key: 'weibo', Icon: SiSinaweibo, label: 'Weibo', group: 'social', brand: '#E6162D' },
]

function Row({
  entries,
  links,
  compact,
}: {
  entries: typeof ENTRIES
  links: Record<string, string>
  compact?: boolean
}) {
  return (
    <div
      className={
        compact ? 'flex flex-wrap items-center gap-0.5' : 'flex flex-wrap items-center gap-2'
      }
    >
      {entries.map(({ key, Icon, label, brand }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          style={{ '--brand': brand } as CSSProperties}
          // Data Desk §7.6.2 : couleur de marque par défaut (les variantes de
          // palette choisies restent visibles sur fond sombre — X/TikTok/Tidal
          // sont en bleu/cyan, pas en noir).
          className={
            compact
              ? 'hover:bg-muted flex size-7 items-center justify-center rounded-full text-[var(--brand)] transition-transform hover:scale-110'
              : 'hover:bg-muted border-border flex size-9 items-center justify-center rounded-full border text-[var(--brand)] transition-transform hover:scale-110'
          }
        >
          <Icon size={compact ? 14 : 18} color="currentColor" />
        </a>
      ))}
    </div>
  )
}

/**
 * Liens externes d'un groupe/artiste en couleurs de marque (§7.6.2).
 * Mode plein : deux rangées (streaming puis social). Mode `compact` : une seule
 * rangée dense (cellule LINKS du stats strip), cap à 6 icônes.
 */
export function LinksBar({
  links,
  compact = false,
}: {
  links: Record<string, string> | null
  compact?: boolean
}) {
  if (!links) return null
  const present = ENTRIES.filter((e) => typeof links[e.key] === 'string' && links[e.key])
  if (present.length === 0) return null

  if (compact) {
    // Ordre de priorité compact (R8) : les réseaux clés passent AVANT le
    // streaming secondaire — sans ça l'Instagram/TikTok sautaient (les 6
    // premières entrées étant toutes du streaming → cap coupait les socials,
    // « oubli » de l'IG de ZB1). Le Row wrap déjà, cap monté à 8.
    const ordered = [...present].sort(
      (a, b) => COMPACT_PRIORITY.indexOf(a.key) - COMPACT_PRIORITY.indexOf(b.key),
    )
    return <Row entries={ordered.slice(0, 8)} links={links} compact />
  }

  const streaming = present.filter((e) => e.group === 'streaming')
  const social = present.filter((e) => e.group === 'social')

  return (
    <div className="space-y-2">
      {streaming.length > 0 && <Row entries={streaming} links={links} />}
      {social.length > 0 && <Row entries={social} links={links} />}
    </div>
  )
}
