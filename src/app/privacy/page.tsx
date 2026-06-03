import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'
import { CONTACT_EMAIL } from '@/lib/site'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="June 2026">
      <p>
        This policy explains what data KStage collects and how it is used. We aim to collect as
        little as possible to run the service.
      </p>

      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account</strong>: email address, username, and (optionally) a profile picture.
        </li>
        <li>
          <strong>Activity</strong>: the groups you follow, your comments, ratings, and likes, and
          any suggestions you submit.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Your data is used only to provide the service — authenticate you, show your follows and
        activity, send the notifications you opt into, and display your public profile (username,
        avatar, comments). We do not sell your data or share it for advertising.
      </p>

      <h2>Hosting &amp; processors</h2>
      <ul>
        <li>
          <strong>Supabase</strong> hosts our database and authentication.
        </li>
        <li>
          <strong>Vercel</strong> hosts the app and provides anonymous, privacy-friendly analytics
          (no cookies, no personal identifiers).
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        KStage uses only essential cookies needed to keep you signed in (your authentication
        session). We do not use advertising or third-party tracking cookies.
      </p>

      <h2>Your choices</h2>
      <p>
        You can edit your profile and notification settings at any time. To delete your account or
        request removal of your data, contact us at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about this policy? Reach out at{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  )
}
