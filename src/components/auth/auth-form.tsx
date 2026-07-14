'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/auth/password-input'
import { USERNAME_MIN, USERNAME_MAX } from '@/lib/profiles/validation'
import { PASSWORD_MIN } from '@/lib/auth/validation'
import type { AuthState } from '@/lib/auth/actions'

type AuthAction = (state: AuthState, formData: FormData) => Promise<AuthState>

const inputClass =
  'h-9 w-full rounded-lg border bg-background px-3 text-base md:text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

export function AuthForm({ mode, action }: { mode: 'login' | 'signup'; action: AuthAction }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null)
  const isLogin = mode === 'login'

  return (
    <form action={formAction} className="space-y-4">
      {!isLogin && (
        <div className="space-y-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            minLength={USERNAME_MIN}
            maxLength={USERNAME_MAX}
            pattern="[A-Za-z0-9_]+"
            className={inputClass}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          {isLogin ? 'Email or username' : 'Email'}
        </label>
        <input
          id="email"
          name="email"
          type={isLogin ? 'text' : 'email'}
          autoComplete={isLogin ? 'username' : 'email'}
          required
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          required
          minLength={isLogin ? undefined : PASSWORD_MIN}
        />
        {isLogin ? (
          <div className="text-right">
            <Link
              href="/reset-password"
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
            >
              Forgot password?
            </Link>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            At least {PASSWORD_MIN} characters, one uppercase letter and one digit.
          </p>
        )}
      </div>

      {!isLogin && (
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </label>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN}
          />
        </div>
      )}

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
