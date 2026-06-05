import { OtpForm } from '@/components/auth/otp-form'

export const metadata = { title: 'Verify your email' }

export default async function VerifySignupPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  // Pas de redirection si l'email manque : l'user a pu fermer la page après
  // l'inscription (§1.4). On l'accueille en mode récupération (saisie manuelle
  // de l'email + code) plutôt que de le renvoyer vers /signup.
  const { email } = await searchParams

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="mx-auto max-w-sm space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Verify your email</h1>
          <p className="text-muted-foreground text-sm">
            {email
              ? 'Enter the code below to finish creating your account.'
              : 'Enter the email you signed up with and the code we sent you to finish creating your account.'}
          </p>
        </div>
        <OtpForm initialEmail={email ?? ''} />
      </div>
    </div>
  )
}
