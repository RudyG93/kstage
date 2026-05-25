import { AuthForm } from '@/components/auth/auth-form'
import { signUp } from '@/lib/auth/actions'

export const metadata = { title: 'Sign up' }

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Sign up</h1>
      <AuthForm mode="signup" action={signUp} />
    </div>
  )
}
