import { redirect } from 'next/navigation'
import { OtpForm } from '@/components/auth/otp-form'

export const metadata = { title: 'Verify your email' }

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  if (!email) redirect('/signup')

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
          <p className="text-muted-foreground text-sm">
            We sent a 6-digit code to <span className="text-foreground font-medium">{email}</span>.
            Enter it below to finish creating your account.
          </p>
        </div>
        <OtpForm email={email} />
      </div>
    </div>
  )
}
