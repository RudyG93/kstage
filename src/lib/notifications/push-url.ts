// Marqueur d'attribution des ouvertures de push (audit §10.3 « notification
// ouverte ») : les URLs des payloads portent `?src=push`, détecté côté client
// par NotificationOpenTracker puis nettoyé via replaceState. Le service worker
// (public/sw.js) matche les clients par PATHNAME — le param ne casse pas le
// focus d'un onglet déjà ouvert.

export function withPushSrc(url: string): string {
  return url.includes('?') ? `${url}&src=push` : `${url}?src=push`
}
