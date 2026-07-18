import { requireAdminPage } from '@/lib/auth/require-admin'
import { getOpenReports } from '@/lib/comments/moderation'
import { ReportsList } from '@/components/mv/comments/reports-list'

export const metadata = { title: 'Moderate reports' }

export default async function AdminReportsPage() {
  await requireAdminPage()

  const reports = await getOpenReports()

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Reported comments</h1>
          <p className="text-muted-foreground text-sm">{reports.length} open</p>
        </div>
        <ReportsList reports={reports} />
      </div>
    </div>
  )
}
