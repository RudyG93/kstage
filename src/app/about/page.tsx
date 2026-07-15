import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <LegalPage title="About KStage">
      <p>
        KStage is an independent k-pop calendar that tracks releases, music videos, music shows,
        birthdays, and debut anniversaries — so you never miss a drop from the groups you follow.
      </p>
      <p>
        It started as a personal project by a fan who wanted a single, clean place to keep up with
        the constant stream of releases. Follow your favorite groups, get reminders, rate and like
        music videos, and discuss them with other fans.
      </p>
      <h2>Where the data comes from</h2>
      <p>
        Events and metadata are aggregated from public sources (official channels, broadcasters, and
        community trackers) and normalized for consistency. Mistakes happen — if you spot one, use
        the <strong>Suggest</strong> button when logged in to send a fix.
      </p>
      <p>
        KStage is a fan-made, non-commercial project and is not affiliated with any of the agencies
        or artists listed.
      </p>
    </LegalPage>
  )
}
