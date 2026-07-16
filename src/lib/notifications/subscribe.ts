import { deletePushSubscription, savePushSubscription } from './actions'
import { sendProductEvent } from '@/components/analytics/beacon'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Clé VAPID base64url → Uint8Array, format attendu par pushManager.subscribe.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

export type SubscribeResult = 'subscribed' | 'denied' | 'unsupported'

/** `surface` = d'où vient la demande (onboarding / account / profile) — sert
 * uniquement aux events produit (funnel push, audit §10.3). */
export async function subscribeToPush(surface?: string): Promise<SubscribeResult> {
  const eventProps = surface ? { surface } : undefined
  if (!pushSupported()) {
    sendProductEvent('push_permission_unavailable', eventProps)
    return 'unsupported'
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error(
      'NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set (restart dev server after filling .env.local)',
    )
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    sendProductEvent('push_permission_denied', eventProps)
    return 'denied'
  }
  sendProductEvent('push_permission_granted', eventProps)

  const reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  // Un abonnement existant (clé éventuellement différente) ferait throw
  // pushManager.subscribe → on le retire d'abord pour re-souscrire proprement.
  const existing = await reg.pushManager.getSubscription()
  if (existing) await existing.unsubscribe()

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })

  const keys = sub.toJSON().keys
  if (!keys?.p256dh || !keys.auth) throw new Error('Push subscription missing keys')

  await savePushSubscription({
    endpoint: sub.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
    userAgent: navigator.userAgent,
  })
  return 'subscribed'
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await getExistingSubscription()
  if (!sub) return
  const { endpoint } = sub
  await sub.unsubscribe()
  await deletePushSubscription(endpoint)
}
