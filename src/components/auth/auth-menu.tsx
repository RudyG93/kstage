import Link from 'next/link'
import { signOut } from '@/lib/auth/actions'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut } from 'lucide-react'

export function AuthMenu({ email }: { email: string | null }) {
  if (!email) {
    return (
      <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        Sign in
      </Link>
    )
  }

  const initials = email.split('@')[0].slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cff] to-[#ff2d87] text-xs font-semibold text-white focus-visible:ring-3 focus-visible:outline-none"
        aria-label="User menu"
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem
          render={
            <Link href="/account" className="flex w-full items-center gap-2">
              <Settings className="size-4" />
              Account settings
            </Link>
          }
        />
        <DropdownMenuItem
          render={
            <form action={signOut} className="w-full">
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut className="size-4" />
                Sign out
              </button>
            </form>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
