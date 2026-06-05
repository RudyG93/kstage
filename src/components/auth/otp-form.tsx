'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { OtpInput } from './otp-input'
import { verifySignupOtp, resendSignupOtp, type AuthState } from '@/lib/auth/actions'
import { OTP_LENGTH } from '@/lib/auth/validation'

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

const RESEND_COOLDOWN = 60

/**
 * Vérification du code d'inscription. `initialEmail` vide = mode récupération
 * (§1.4) : l'user a fermé la page, il arrive sur /signup/verify et saisit son
 * email manuellement avant le code.
 */
export function OtpForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(verifySignupOtp, null)
  const [email, setEmail] = useState(initialEmail)
  const [cooldown, setCooldown] = useState(0)
  const resending = useRef(false)
  const knownEmail = initialEmail.length > 0

  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  async function resend() {
    if (cooldown > 0 || resending.current) return
    if (!email.includes('@')) {
      toast.error('Enter your email first.')
      return
    }
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
      {knownEmail ? (
        <>
          <p className="text-muted-foreground text-sm">
            We sent a {OTP_LENGTH}-digit code to{' '}
            <span className="text-foreground font-medium">{email}</span>.
          </p>
          <input type="hidden" name="email" value={email} />
        </>
      ) : (
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <span className="block text-center text-sm font-medium">Verification code</span>
        <OtpInput length={OTP_LENGTH} name="token" disabled={pending} invalid={!!state?.error} />
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-center text-sm">
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
