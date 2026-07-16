// Envoi d'emails transactionnels via l'API Resend (§1.5). Appel HTTP direct
// (pas de SDK) pour rester sans dépendance. Server-only de fait : importé
// uniquement depuis les Server Actions ('use server') — la clé Resend n'est
// jamais bundlée côté client.

import { SITE_URL } from '@/lib/site'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM
  if (!apiKey || !from) {
    console.warn('[email] RESEND_API_KEY/RESEND_FROM manquant — envoi ignoré')
    return
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    console.error('[email] Resend a échoué', res.status, await res.text().catch(() => ''))
  }
}

/** Exporté pour le test de contrat (les liens du mail pointent /calendar). */
export function welcomeHtml(username: string | null): string {
  const hello = username ? `Hi ${username},` : 'Hi,'
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#0f1118;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e7e7ea;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1118;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#16161d;border-radius:16px;overflow:hidden;border:1px solid #26262f;">
          <tr><td style="padding:28px 28px 8px;">
            <div style="font-size:22px;font-weight:800;background:linear-gradient(90deg,#8785ff,#3fe0b8);-webkit-background-clip:text;background-clip:text;color:#8785ff;">KStage</div>
          </td></tr>
          <tr><td style="padding:8px 28px 4px;">
            <h1 style="margin:0;font-size:20px;color:#fff;">Welcome to KStage! 🎉</h1>
          </td></tr>
          <tr><td style="padding:12px 28px 4px;font-size:14px;line-height:1.6;color:#c9c9d1;">
            <p style="margin:0 0 12px;">${hello}</p>
            <p style="margin:0 0 12px;">
              Your account is active. KStage is your k-pop calendar — releases, music videos, music shows,
              birthdays, and debut anniversaries, all in one place.
            </p>
            <p style="margin:0 0 4px;">Get started:</p>
            <ul style="margin:0 0 12px;padding-left:18px;">
              <li style="margin:4px 0;"><a href="${SITE_URL}/calendar" style="color:#b79bff;">See your personalized calendar</a></li>
              <li style="margin:4px 0;"><a href="${SITE_URL}/groups" style="color:#b79bff;">Follow more groups</a></li>
              <li style="margin:4px 0;"><a href="${SITE_URL}/account" style="color:#b79bff;">Turn on notifications</a></li>
            </ul>
          </td></tr>
          <tr><td style="padding:8px 28px 28px;">
            <a href="${SITE_URL}/calendar" style="display:inline-block;background:linear-gradient(90deg,#5b5bf0,#3fe0b8);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 20px;border-radius:10px;">Open your calendar</a>
          </td></tr>
        </table>
        <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#6b6b74;">You're receiving this because you signed up for KStage.</p>
      </td></tr>
    </table>
  </body>
</html>`
}

/** Mail de bienvenue post-vérification (best-effort, ne doit jamais bloquer le flow). */
export async function sendWelcomeEmail(to: string, username: string | null) {
  await sendEmail({ to, subject: 'Welcome to KStage!', html: welcomeHtml(username) })
}
