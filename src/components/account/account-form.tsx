'use client'

import { useActionState, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { AvatarCropper } from './avatar-cropper'
import { updateProfile, type ProfileState } from '@/lib/profiles/actions'
import { USERNAME_MIN, USERNAME_MAX } from '@/lib/profiles/validation'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function AccountForm({
  email,
  username,
  avatarUrl,
}: {
  email: string
  username: string
  avatarUrl: string | null
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, null)
  const ok = state !== null && 'ok' in state
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl)

  return (
    <div className="bg-card ring-foreground/10 space-y-6 rounded-2xl p-6 ring-1">
      <div className="flex items-center gap-4">
        <Avatar
          email={email}
          username={username || undefined}
          avatarUrl={currentAvatar}
          size={64}
        />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Avatar</p>
          <AvatarCropper onUpdated={setCurrentAvatar} />
          <p className="text-muted-foreground text-xs">
            PNG, JPEG or WebP, up to 2 MB · saved instantly.
          </p>
        </div>
      </div>

      <form action={formAction} className="border-border space-y-5 border-t pt-6">
        <div className="space-y-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            defaultValue={username}
            placeholder="your_handle"
            className={inputClass}
          />
          <p className="text-muted-foreground text-xs">
            {USERNAME_MIN}–{USERNAME_MAX} characters · letters, numbers and underscores.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className={`${inputClass} opacity-60`}
          />
        </div>

        {state !== null && 'error' in state && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        {ok && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            Username saved.
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </form>
    </div>
  )
}
