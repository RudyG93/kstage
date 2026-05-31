import type { ComponentType } from 'react'
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

// Ordre d'affichage : plateformes d'écoute puis réseaux sociaux.
const ENTRIES: { key: string; Icon: ComponentType<IconProps>; label: string }[] = [
  { key: 'spotify', Icon: SiSpotify, label: 'Spotify' },
  { key: 'apple_music', Icon: SiApplemusic, label: 'Apple Music' },
  { key: 'youtube_music', Icon: SiYoutubemusic, label: 'YouTube Music' },
  { key: 'deezer', Icon: SiDeezer, label: 'Deezer' },
  { key: 'tidal', Icon: SiTidal, label: 'Tidal' },
  { key: 'soundcloud', Icon: SiSoundcloud, label: 'SoundCloud' },
  { key: 'youtube', Icon: SiYoutube, label: 'YouTube' },
  { key: 'instagram', Icon: SiInstagram, label: 'Instagram' },
  { key: 'twitter', Icon: SiX, label: 'X' },
  { key: 'tiktok', Icon: SiTiktok, label: 'TikTok' },
  { key: 'facebook', Icon: SiFacebook, label: 'Facebook' },
  { key: 'weibo', Icon: SiSinaweibo, label: 'Weibo' },
]

export function LinksBar({ links }: { links: Record<string, string> | null }) {
  if (!links) return null
  const present = ENTRIES.filter((e) => typeof links[e.key] === 'string' && links[e.key])
  if (present.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {present.map(({ key, Icon, label }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className="text-muted-foreground hover:text-foreground hover:bg-muted ring-foreground/10 flex size-9 items-center justify-center rounded-full ring-1 transition-colors"
        >
          <Icon size={18} color="currentColor" />
        </a>
      ))}
    </div>
  )
}
