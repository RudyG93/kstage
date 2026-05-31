'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { verifySignupOtp, resendSignupOtp, type AuthState } from '@/lib/auth/actions'

const inputClass =
  'h-11 w-full rounded-lg border bg-background px-3 text-center font-mono text-lg tracking-[0.5em] outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

const RESEND_COOLDOWN = 60

export function OtpForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(verifySignupOtp, null)
  const [cooldown, setCooldown] = useState(0)
  const resending = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || resending.current) return
    resending.current = true
    const res = await resendSignupOtp(email)
    resending.current = false
    if ('error' in res) {
      toast.error(res.error)
      return
    }
    toast.success('A new code is on its way.')
    setCooldown(RESEND_COOLDOWN)
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="email" value={email} />

      <div className="space-y-1.5">
        <label htmlFor="token" className="text-sm font-medium">
          Verification code
        </label>
        <input
          id="token"
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6,10}"
          maxLength={10}
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
        {pending ? 'Verifying…' : 'Verify'}
      </Button>

      <button
        type="button"
        onClick={resend}
        disabled={cooldown > 0}
        className="text-muted-foreground hover:text-foreground w-full text-center text-sm underline underline-offset-4 disabled:no-underline disabled:opacity-60"
      >
        {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </form>
  )
}
