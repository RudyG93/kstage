import Link from 'next/link'
import { Settings, LogOut, User } from 'lucide-react'
import { signOut } from '@/lib/auth/actions'
import { buttonVariants } from '@/components/ui/button'
import { Avatar } from '@/components/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

export function AuthMenu({
  email,
  username,
  avatarUrl,
}: {
  email: string | null
  username?: string | null
  avatarUrl?: string | null
}) {
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-3"
          />
        }
      >
        <Avatar email={email} username={username ?? undefined} avatarUrl={avatarUrl} size={32} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuItem render={<Link href={username ? `/u/${username}` : '/account'} />}>
          <User className="size-4" />
          My profile
        </DropdownMenuItem>
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
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
