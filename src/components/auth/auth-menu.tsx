import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import { buttonVariants } from '@/components/ui/button'

export function AuthMenu({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        Sign in
      </Link>
    )
  }

  return (
    <form action={signOut} className="flex items-center gap-2">
      <span className="text-muted-foreground hidden max-w-[14ch] truncate text-xs sm:inline">
        {email}
      </span>
      <button type="submit" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        Sign out
      </button>
    </form>
  )
}
