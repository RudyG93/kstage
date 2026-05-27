'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { AvatarCropper } from './avatar-cropper'
import { updateProfile, updateAvatar, type ProfileState } from '@/lib/profiles/actions'
import { USERNAME_MIN, USERNAME_MAX } from '@/lib/profiles/validation'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/30'

function ErrorBanner({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

export function AccountForm({
  email,
  username,
  avatarUrl,
}: {
  email: string
  username: string
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(updateProfile, null)
  const usernameError = state !== null && 'error' in state ? state.error : null
  const ok = state !== null && 'ok' in state

  const [currentAvatar, setCurrentAvatar] = useState<string | null>(avatarUrl)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [avatarPending, startAvatar] = useTransition()

  function handleCropped(blob: Blob) {
    const localUrl = URL.createObjectURL(blob)
    const previous = currentAvatar
    setAvatarError(null)
    setCurrentAvatar(localUrl) // aperçu optimiste, immédiat

    startAvatar(async () => {
      const fd = new FormData()
      fd.append('avatar', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      const res = await updateAvatar(fd)
      URL.revokeObjectURL(localUrl)
      if ('error' in res) {
        setCurrentAvatar(previous) // revert
        setAvatarError(res.error)
        return
      }
      setCurrentAvatar(res.avatarUrl)
      router.refresh() // met à jour l'avatar du header en arrière-plan
    })
  }

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
          <AvatarCropper onCropped={handleCropped} />
          <p className="text-muted-foreground text-xs">
            {avatarPending ? 'Saving…' : 'PNG, JPEG or WebP, up to 2 MB · saved instantly.'}
          </p>
        </div>
      </div>

      {avatarError && <ErrorBanner>{avatarError}</ErrorBanner>}

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
            aria-invalid={usernameError !== null || undefined}
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

        {usernameError && <ErrorBanner>{usernameError}</ErrorBanner>}
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
