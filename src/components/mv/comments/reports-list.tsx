'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { resolveReport, dismissReport, type OpenReport } from '@/lib/comments/moderation'

type ModAction = (id: string) => Promise<{ error: string } | { ok: true }>

export function ReportsList({ reports }: { reports: OpenReport[] }) {
  if (reports.length === 0) {
    return <p className="text-muted-foreground text-sm">No open reports.</p>
  }
  return (
    <ul className="space-y-3">
      {reports.map((r) => (
        <ReportItem key={r.id} report={r} />
      ))}
    </ul>
  )
}

function ReportItem({ report }: { report: OpenReport }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run(action: ModAction) {
    setError(null)
    startTransition(async () => {
      const res = await action(report.id)
      if ('error' in res) setError(res.error)
    })
  }

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <p className={report.deleted ? 'text-muted-foreground text-sm line-through' : 'text-sm'}>
        {report.body}
      </p>
      <p className="text-muted-foreground text-xs">
        by {report.authorUsername ?? 'unknown'}
        {report.eventSlug && (
          <>
            {' · '}
            <Link href={`/mv/${report.eventSlug}`} className="underline">
              {report.eventTitle ?? 'event'}
            </Link>
          </>
        )}
      </p>
      {report.reason && <p className="text-xs italic">Reason: {report.reason}</p>}
      {report.deleted && <p className="text-muted-foreground text-xs">(already deleted)</p>}
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run(resolveReport)}
        >
          Remove comment
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(dismissReport)}>
          Dismiss
        </Button>
      </div>
    </li>
  )
}
