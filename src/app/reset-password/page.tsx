import { RequestResetForm } from '@/components/auth/request-reset-form'

export const metadata = { title: 'Reset password' }

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Reset password</h1>
          <p className="text-muted-foreground text-sm">
            Enter your email and we&apos;ll send you a code to set a new password.
          </p>
        </div>
        <RequestResetForm />
      </div>
    </div>
  )
}
