'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { AuthState } from '@/lib/auth/actions'

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function AuthForm({ mode, action }: { mode: 'login' | 'signup'; action: AuthAction }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null)
  const isLogin = mode === 'login'

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
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={6}
          className={inputClass}
        />
      </div>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {isLogin ? 'Sign in' : 'Sign up'}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {isLogin ? (
          <>
            No account yet?{' '}
            <Link href="/signup" className="text-foreground underline">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link href="/login" className="text-foreground underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
