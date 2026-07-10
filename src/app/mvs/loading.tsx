import { PageSkeleton } from '@/components/ui/page-skeleton'

// Page liste (pas de notFound() en dessous) : le skeleton peut streamer sans
// casser le statut HTTP — cf. commentaire de PageSkeleton.
export default function Loading() {
  return <PageSkeleton />
}
