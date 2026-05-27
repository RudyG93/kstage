import Link from 'next/link'
import { Settings, LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'
import { buttonVariants } from '@/components/ui/button'
<<<<<<< HEAD
import { Avatar } from '@/components/avatar'
=======
>>>>>>> origin/main
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
<<<<<<< HEAD
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
=======
} from '@/components/ui/dropdown-menu'
import { Settings, LogOut } from 'lucide-react'
>>>>>>> origin/main

export function AuthMenu({ email }: { email: string | null }) {
  if (!email) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Log in
        </Link>
        <Link
          href="/signup"
          className="gradient-signature inline-flex h-7 items-center rounded-md px-3 text-sm font-medium text-white"
        >
          Sign up
        </Link>
      </div>
    )
  }

  const initials = email.split('@')[0].slice(0, 2).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
<<<<<<< HEAD
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
          />
        }
      >
        <Avatar email={email} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem render={<Link href="/account" />}>
          <Settings className="size-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut} className="contents">
          <DropdownMenuItem render={<button type="submit" />}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </form>
=======
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
>>>>>>> origin/main
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
