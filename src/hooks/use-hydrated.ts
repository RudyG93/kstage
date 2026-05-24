import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

// `true` seulement après hydratation côté client (`false` au rendu serveur),
// sans setState dans un effect — sert à rendre du contenu client-only proprement.
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
