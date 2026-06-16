'use client'

import { useActionState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updatePassword, type AuthResult } from '@/lib/auth/actions'
import { PASSWORD_MIN } from '@/lib/auth/validation'

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

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(updatePassword, null)
  const error = state !== null && 'error' in state ? state.error : null
  const ok = state !== null && 'ok' in state

  return (
    <div className="bg-card border-border shadow-soft space-y-6 rounded-2xl border p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Password</h2>
        <p className="text-muted-foreground text-sm">
          Change your password. You&apos;ll need your current one to confirm.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="current" className="text-sm font-medium">
            Current password
          </label>
          <input
            id="current"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={error !== null || undefined}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            className={inputClass}
          />
          <p className="text-muted-foreground text-xs">
            At least {PASSWORD_MIN} characters, one uppercase letter and one digit.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
            className={inputClass}
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {ok && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            Password updated.
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </div>
  )
}
