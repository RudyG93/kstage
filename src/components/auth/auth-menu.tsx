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
          className="gradient-signature inline-flex h-7 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-white"
        >
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <DropdownMenu>
      {/* Trigger en flex : sans ça l'avatar inline garde un offset de baseline
          et le menu ne s'aligne pas exactement sous lui. */}
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className="focus-visible:ring-ring/50 flex rounded-full outline-none focus-visible:ring-2"
          />
        }
      >
        <Avatar email={email} username={username ?? undefined} avatarUrl={avatarUrl} size={32} />
      </DropdownMenuTrigger>
      {/* Panneau Data Desk : card + hairline + rayon 10, items compacts. */}
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="bg-card min-w-48 rounded-lg border p-1 shadow-lg"
      >
        {username && (
          <div className="border-b px-2.5 pt-1.5 pb-2">
            <p className="truncate text-xs font-semibold">{username}</p>
            <p className="text-faint truncate text-[10px]">{email}</p>
          </div>
        )}
        <DropdownMenuItem
          className="gap-2 rounded-[7px] px-2.5 py-2 text-xs"
          render={<Link href={username ? `/u/${username}` : '/account'} />}
        >
          <User className="text-muted-foreground size-3.5" />
          My profile
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2 rounded-[7px] px-2.5 py-2 text-xs"
          render={<Link href="/account" />}
        >
          <Settings className="text-muted-foreground size-3.5" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut} className="contents">
          <DropdownMenuItem
            className="text-rose gap-2 rounded-[7px] px-2.5 py-2 text-xs"
            render={<button type="submit" />}
          >
            <LogOut className="size-3.5" />
            Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
