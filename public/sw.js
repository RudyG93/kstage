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
  const { title = 'KStage', body = '', url = '/', tag, icon, image, actions, renotify, timestamp } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      // Icône par artiste quand le payload la porte (comebacks), sinon l'app.
      icon: icon || '/icons/icon-192.png',
      // Badge Android = silhouette MONOCHROME dédiée (le PNG couleur était
      // aplati en pâté gris dans la barre de statut).
      badge: '/icons/badge-96.png',
      // Grande visuelle (Android/desktop) et boutons d'action, si fournis.
      ...(image ? { image } : {}),
      ...(actions ? { actions } : {}),
      // tag : les notifs de même famille se REMPLACENT au lieu de s'empiler
      // (digest du jour, rappels successifs d'un même comeback). Le buzz du
      // remplacement (renotify) est désormais PILOTÉ PAR LE PAYLOAD : les
      // comebacks buzzent (J-1 → « Out now »), le digest se remplace en
      // silence (audit notifs 2026-08-20).
      ...(tag ? { tag, ...(renotify ? { renotify: true } : {}) } : {}),
      // Horodatage de l'EVENT quand fourni (tiroir Android trié par date).
      timestamp: timestamp || Date.now(),
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

// Rotation d'endpoint (2026-08-23). Un navigateur peut invalider une
// souscription à tout moment — mise à jour, purge du profil, expiration côté
// service de push — et émet alors `pushsubscriptionchange`. Sans ce listener,
// la nouvelle souscription n'était connue de personne : le navigateur se
// croyait abonné, la base gardait un endpoint mort, plus rien n'arrivait.
//
// Un SW ne peut pas appeler une server action → route dédiée, authentifiée par
// le cookie de session (même origine, il est envoyé).
function base64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i)
  return arr
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = event.oldSubscription?.endpoint ?? null
      let sub = event.newSubscription ?? null
      if (!sub) {
        // La clé de l'ancienne souscription quand le navigateur la fournit,
        // sinon on la redemande au serveur : re-souscrire sans clé échoue.
        let key = event.oldSubscription?.options?.applicationServerKey ?? null
        if (!key) {
          const res = await fetch('/api/push/rotate')
          if (!res.ok) return
          key = base64ToUint8Array((await res.json()).key)
        }
        sub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key,
        })
      }
      await fetch('/api/push/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() }),
      })
    })(),
  )
})
