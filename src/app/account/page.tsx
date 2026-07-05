import { redirect } from 'next/navigation'
import { AccountForm } from '@/components/account/account-form'
import { ChangePasswordForm } from '@/components/account/change-password-form'
import { IosInstallHint } from '@/components/notifications/ios-install-hint'
import { PushToggle } from '@/components/notifications/push-toggle'
import { NotificationPrefs } from '@/components/notifications/notification-prefs'
import { createClient } from '@/lib/supabase/server'
import { getNotificationPrefs } from '@/lib/notifications/queries'
import { getProfile } from '@/lib/profiles/queries'

export const metadata = { title: 'Account settings' }

export default async function AccountPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profile, notificationPrefs] = await Promise.all([
    getProfile(user.id),
    getNotificationPrefs(),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold tracking-tight">Account settings</h1>
          <p className="text-muted-foreground text-sm">
            Choose how you appear across KStage — your username and avatar show up on the reviews
            and comments you post.
          </p>
        </div>
        <AccountForm
          email={user.email ?? ''}
          username={profile?.username ?? ''}
          avatarUrl={profile?.avatar_url ?? null}
        />

        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight">Notifications</h2>
          <IosInstallHint />
          <PushToggle />
          <NotificationPrefs initial={notificationPrefs} />
        </section>

        <ChangePasswordForm />
      </div>
    </div>
  )
}
