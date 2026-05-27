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
