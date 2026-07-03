import Link from 'next/link'
import { CONTACT_EMAIL } from '@/lib/site'
import { FeedbackDialog } from '@/components/feedback/feedback-dialog'

const LINKS = [
  { href: '/about', label: 'About' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
] as const

export function Footer() {
  return (
    <footer className="border-t">
      {/* pb-24 dégage la bottom-nav fixe sur mobile ; md:pb-8 sur desktop */}
      <div className="text-muted-foreground mx-auto w-full max-w-2xl space-y-3 px-4 pt-8 pb-24 text-sm md:pb-8">
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground transition-colors">
              {label}
            </Link>
          ))}
          <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground transition-colors">
            Contact
          </a>
          <FeedbackDialog triggerClassName="hover:text-foreground inline-flex cursor-pointer items-center gap-1 transition-colors" />
        </nav>
        <p className="text-xs">
          Indie project, not affiliated with any of the agencies or artists listed.
        </p>
        <p className="text-xs">© {new Date().getFullYear()} KStage.</p>
      </div>
    </footer>
  )
}
