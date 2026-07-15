import type { Database } from '@/types/database'

type EventType = Database['public']['Enums']['event_type']
type HeroCandidate = { type: EventType }

const HERO_EVENT_TYPES = new Set<EventType>(['mv', 'release', 'music_show'])

export function findHeroEventIndex(events: readonly HeroCandidate[]): number {
  return events.findIndex((event) => HERO_EVENT_TYPES.has(event.type))
}
