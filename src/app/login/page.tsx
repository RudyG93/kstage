import { AuthForm } from '@/components/auth/auth-form'
import { signIn } from '@/lib/auth/actions'

export const metadata = { title: 'Sign in' }

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-sm space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
        <AuthForm mode="login" action={signIn} />
      </div>
    </div>
  )
}
