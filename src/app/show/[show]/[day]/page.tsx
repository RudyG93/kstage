import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCommentsForTarget } from '@/lib/comments/queries'
import { buildCommentTree, sortTree } from '@/lib/comments/tree'
import { kstDayBounds, kstTime24h, formatKst } from '@/lib/events/date'
import { extractYouTubeId } from '@/lib/events/youtube-id'
import { SHOW_DESCRIPTORS } from '@/lib/scrapers/music-shows/types'
import { faceCrop } from '@/lib/images/cloudinary'
import { BackButton } from '@/components/back-button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { CommentSection } from '@/components/mv/comments/comment-section'
import { LocalTime } from '@/components/local-time'

// Page ÉPISODE de music show (Lot N, demande Rudy 2026-07-17) : logo du show,
// numéro/date, lineup complet, stages YouTube des participants, commentaires.
// Ancrée sur show_episodes (une row par show + jour KST, upsertée par le cron) —
// les rows events du jour restent la source du lineup/stages à l'affichage.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

async function loadEpisode(show: string, day: string) {
  const descriptor = SHOW_DESCRIPTORS.find((s) => s.id === show)
  if (!descriptor || !DAY_RE.test(day)) return null
  const supabase = await createClient()
  const { data: episode } = await supabase
    .from('show_episodes')
    .select('id, show_title, kst_day, episode_number, start_at')
    .eq('show_title', descriptor.displayName)
    .eq('kst_day', day)
    .maybeSingle()
  if (!episode) return null
  return { descriptor, episode }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ show: string; day: string }>
}): Promise<Metadata> {
  const { show, day } = await params
  const loaded = await loadEpisode(show, day)
  if (!loaded) return { title: 'Episode not found' }
  const { episode } = loaded
  const label = episode.episode_number
    ? `${episode.show_title} #${episode.episode_number}`
    : episode.show_title
  return {
    title: label,
    description: `${label} — lineup, stages and discussion on KStage.`,
  }
}

export default async function ShowEpisodePage({
  params,
}: {
  params: Promise<{ show: string; day: string }>
}) {
  const { show, day } = await params
  const loaded = await loadEpisode(show, day)
  if (!loaded) notFound()
  const { descriptor, episode } = loaded

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const viewerId = user?.id ?? null

  // Rows events du jour = lineup + stages (mêmes bornes KST que le scraper).
  const { from, to } = kstDayBounds(episode.start_at)
  const [{ data: rows }, flatComments] = await Promise.all([
    supabase
      .from('events')
      .select('id, title, start_at, stage_url, groups!inner(slug, name, image_url)')
      .eq('type', 'music_show')
      .eq('title', episode.show_title)
      .eq('hidden', false)
      .gte('start_at', from)
      .lt('start_at', to)
      .order('start_at', { ascending: true }),
    getCommentsForTarget({ episodeId: episode.id }, viewerId),
  ])
  const lineup = rows ?? []
  const commentRoots = sortTree(buildCommentTree(flatComments), 'top')

  const label = episode.episode_number
    ? `${episode.show_title} #${episode.episode_number}`
    : episode.show_title
  const path = `/show/${descriptor.id}/${episode.kst_day}`
  const dateLabel = formatKst(episode.start_at, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <BackButton />

      <header className="flex items-start gap-3">
        <Image
          src={descriptor.iconUrl}
          alt=""
          width={56}
          height={56}
          unoptimized
          className="size-14 shrink-0 rounded-lg object-cover"
          aria-hidden
        />
        <div className="min-w-0">
          <h1 className="font-heading text-xl leading-tight font-extrabold tracking-[-0.02em]">
            {label}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-[11px] font-medium">
            {dateLabel} · <LocalTime iso={episode.start_at} withZone={false} fallback="—" /> local ·{' '}
            {kstTime24h(episode.start_at)} KST
          </p>
          {lineup.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {lineup.map((e) => e.groups?.name ?? '?').join(', ')}
            </p>
          )}
        </div>
      </header>

      <Panel>
        <PanelHeader label={`Stages — ${lineup.length}`} />
        {lineup.length === 0 ? (
          <p className="text-muted-foreground px-3 py-4 text-sm">
            No lineup details for this episode yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
            {lineup.map((e) => {
              const videoId = e.stage_url ? extractYouTubeId(e.stage_url) : null
              return (
                <div key={e.id} className="flex items-center gap-3 p-3">
                  {e.groups?.image_url ? (
                    <Image
                      src={faceCrop(e.groups.image_url, 72, 72)}
                      alt=""
                      width={36}
                      height={36}
                      unoptimized
                      className="size-9 shrink-0 rounded-md object-cover"
                      aria-hidden
                    />
                  ) : (
                    <span
                      className="gradient-signature flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
                      aria-hidden
                    >
                      {e.groups?.name?.[0] ?? '?'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/groups/${e.groups?.slug ?? ''}`}
                      className="hover:text-primary block truncate text-sm font-semibold transition-colors"
                    >
                      {e.groups?.name ?? '?'}
                    </Link>
                    {videoId ? (
                      <a
                        href={e.stage_url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                      >
                        Watch stage
                        <ExternalLink className="size-3" aria-label="Opens YouTube" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-xs">Stage video pending</span>
                    )}
                  </div>
                  {videoId && (
                    <a
                      href={e.stage_url as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-hidden
                      tabIndex={-1}
                      className="shrink-0"
                    >
                      {/* hqdefault existe pour toute vidéo (maxres non garanti). */}
                      <Image
                        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                        alt=""
                        width={96}
                        height={54}
                        unoptimized
                        className="h-[54px] w-24 rounded-md object-cover"
                      />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <CommentSection
        episodeId={episode.id}
        path={path}
        isAuthed={!!user}
        viewerId={viewerId}
        roots={commentRoots}
        initialSort="top"
      />
    </div>
  )
}
