'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { requestPasswordReset, type AuthState } from '@/lib/auth/actions'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-base md:text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null,
  )

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending…' : 'Send reset code'}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{' '}
        <Link href="/login" className="text-foreground underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
