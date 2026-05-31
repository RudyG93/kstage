import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export const metadata = { title: 'Set a new password' }

export default async function ResetPasswordVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/reset-password')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
          <p className="text-muted-foreground text-sm">
            If an account exists for <span className="text-foreground font-medium">{email}</span>, a
            code was sent. Enter it with your new password.
          </p>
        </div>
        <ResetPasswordForm email={email} />
      </div>
    </div>
  )
}
