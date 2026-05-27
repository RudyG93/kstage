import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-24 text-center">
      <p className="gradient-text font-mono text-sm font-bold tracking-[0.25em] uppercase">404</p>
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground text-sm">This page doesn&apos;t exist or has moved.</p>
      </div>
      <Link href="/" className={buttonVariants()}>
        Back to home
      </Link>
    </div>
  )
}
