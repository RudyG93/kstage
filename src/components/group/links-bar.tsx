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

type LinkGroup = 'streaming' | 'social'

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
  { key: 'facebook', Icon: SiFacebook, label: 'Facebook', group: 'social', brand: '#1877F2' },
  { key: 'weibo', Icon: SiSinaweibo, label: 'Weibo', group: 'social', brand: '#E6162D' },
]

function Row({ entries, links }: { entries: typeof ENTRIES; links: Record<string, string> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(({ key, Icon, label, brand }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          style={{ '--brand': brand } as CSSProperties}
          // Couleur de marque en thème CLAIR ; sur fond sombre on garde le
          // muted-foreground (visible) — sinon les marques noires (X/TikTok/Tidal)
          // disparaîtraient. Hover = couleur de marque dans les deux thèmes.
          className="dark:text-muted-foreground hover:bg-muted border-border flex size-9 items-center justify-center rounded-full border text-[var(--brand)] transition-[color,transform] hover:scale-110 hover:text-[var(--brand)]"
        >
          <Icon size={18} color="currentColor" />
        </a>
      ))}
    </div>
  )
}

/**
 * Liens externes d'un groupe/artiste, séparés en deux rangées (§6.2) :
 * plateformes d'écoute puis réseaux sociaux. Couleur de marque au survol (§6.3).
 */
export function LinksBar({ links }: { links: Record<string, string> | null }) {
  if (!links) return null
  const present = ENTRIES.filter((e) => typeof links[e.key] === 'string' && links[e.key])
  if (present.length === 0) return null

  const streaming = present.filter((e) => e.group === 'streaming')
  const social = present.filter((e) => e.group === 'social')

  return (
    <div className="space-y-2">
      {streaming.length > 0 && <Row entries={streaming} links={links} />}
      {social.length > 0 && <Row entries={social} links={links} />}
    </div>
  )
}
