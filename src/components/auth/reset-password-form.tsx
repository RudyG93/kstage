'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OtpInput } from './otp-input'
import { PasswordInput } from './password-input'
import { resetPassword, resendRecoveryOtp, type AuthState } from '@/lib/auth/actions'
import { PASSWORD_MIN, OTP_LENGTH } from '@/lib/auth/validation'

const RESEND_COOLDOWN = 60

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(resetPassword, null)
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
    const res = await resendRecoveryOtp(email)
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
        <span className="block text-center text-sm font-medium">Verification code</span>
        <OtpInput length={OTP_LENGTH} name="token" disabled={pending} invalid={!!state?.error} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          New password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
        />
        <p className="text-muted-foreground text-xs">
          At least {PASSWORD_MIN} characters, one uppercase letter and one digit.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-sm font-medium">
          Confirm new password
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-center text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Updating…' : 'Set new password'}
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
