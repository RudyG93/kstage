import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/admin'
import { getFeedbackList } from '@/lib/feedback/actions'
import { FeedbackAdminList } from '@/components/feedback/feedback-admin-list'

export const metadata = { title: 'User feedback' }

export default async function AdminFeedbackPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isAdmin(user.email)) redirect('/')

  const feedback = await getFeedbackList()
  const unread = feedback.filter((f) => f.status === 'new').length

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">User feedback</h1>
          <p className="text-muted-foreground text-sm">
            {feedback.length} total · {unread} unread
          </p>
        </div>
        <FeedbackAdminList items={feedback} />
      </div>
    </div>
  )
}
