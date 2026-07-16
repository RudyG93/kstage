// Service worker KStage — notifications push uniquement (étape 6).
// Servi statiquement depuis /sw.js. Pas de precaching offline ici (étape 9).

self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'KStage', body: event.data.text() }
  }
  const { title = 'KStage', body = '', url = '/', tag } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      // Badge Android = silhouette MONOCHROME dédiée (le PNG couleur était
      // aplati en pâté gris dans la barre de statut).
      badge: '/icons/badge-96.png',
      // tag : les notifs de même famille se REMPLACENT au lieu de s'empiler
      // (digest du jour, rappels successifs d'un même comeback) ; renotify
      // garde le buzz sur la mise à jour.
      ...(tag ? { tag, renotify: true } : {}),
      timestamp: Date.now(),
      data: { url },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  // Match par PATHNAME : les URLs push portent `?src=push` (attribution
  // analytics) — un includes() sur l'URL complète ne matcherait plus jamais
  // un onglet ouvert (dont l'URL est déjà nettoyée par replaceState).
  const targetPath = new URL(url, self.location.origin).pathname
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).pathname === targetPath && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(url)
    }),
  )
})
