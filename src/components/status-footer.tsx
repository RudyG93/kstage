import type { SourcesStatus } from '@/lib/sources/queries'

const updatedAgo = (iso: string | null) => {
  if (!iso) return null
  const mins = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 60) return `${mins} MIN AGO`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} H AGO`
  return `${Math.floor(hours / 24)} D AGO`
}

// Footer statut data-forward (§7.1.8) : « 12 SOURCES SCRAPED · UPDATED 2 MIN AGO ».
export function StatusFooter({ status }: { status: SourcesStatus | null }) {
  if (!status) return null
  const ago = updatedAgo(status.lastScrapedAt)
  return (
    <p className="tabular text-faint py-1 text-center text-[9px] font-semibold tracking-[0.18em]">
      {status.count} SOURCES SCRAPED{ago ? ` · UPDATED ${ago}` : ''}
    </p>
  )
}
