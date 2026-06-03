import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal-page'

export const metadata: Metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="June 2026">
      <p>
        By accessing or using KStage, you agree to these terms. If you do not agree, please do not
        use the service. KStage is an independent, non-commercial project provided for fans.
      </p>

      <h2>Your account</h2>
      <p>
        You are responsible for keeping your login credentials secure and for all activity under
        your account. Choose a username that does not impersonate another person or brand.
      </p>

      <h2>User content</h2>
      <p>
        Comments, suggestions, and other content you submit remain your responsibility. By posting,
        you grant KStage permission to display that content within the service. We may moderate,
        edit, or remove content that breaks these terms or that we consider spam, abusive, illegal,
        or off-topic.
      </p>

      <h2>Acceptable use</h2>
      <ul>
        <li>No spam, harassment, hate speech, or illegal content.</li>
        <li>No attempts to disrupt, overload, or reverse-engineer the service.</li>
        <li>No automated scraping or bulk access without permission.</li>
      </ul>

      <h2>No warranty</h2>
      <p>
        KStage is provided &ldquo;as is&rdquo;, without warranties of any kind. Event dates and
        details are aggregated from public sources and may be incomplete or inaccurate. We are not
        liable for any loss arising from reliance on the information shown.
      </p>

      <h2>Not affiliated</h2>
      <p>
        KStage is a fan-made project and is not affiliated with, endorsed by, or sponsored by any of
        the agencies or artists mentioned. All trademarks belong to their respective owners.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms over time. Continued use of KStage after changes means you accept
        the updated terms.
      </p>
    </LegalPage>
  )
}
