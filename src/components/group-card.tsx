import Image from 'next/image'
import Link from 'next/link'
import { FollowButton } from '@/components/follow-button'
import { faceCrop } from '@/lib/images/cloudinary'
import type { GroupSummary } from '@/lib/groups/queries'

/**
 * Carte groupe carrée : image plein cadre, nom en overlay, cœur de suivi.
 * `href` optionnel pointe `/artists/[memberSlug]` côté tab Solo ; défaut
 * `/groups/[slug]`.
 */
export function GroupCard({
  group,
  isFollowing,
  isAuthed,
  href,
}: {
  group: GroupSummary
  isFollowing: boolean
  isAuthed: boolean
  href?: string
}) {
  const img = group.image_url ? faceCrop(group.image_url, 600, 600) : null

  return (
    <div className="group ring-foreground/10 relative aspect-square overflow-hidden rounded-xl ring-1 transition hover:ring-2 hover:ring-white/20">
      {img ? (
        <Image
          src={img}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="(min-width: 768px) 320px, 50vw"
          className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div
          className="gradient-signature flex h-full w-full items-center justify-center text-3xl font-bold text-white"
          aria-hidden
        >
          {group.name[0]}
        </div>
      )}

      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
        aria-hidden
      />

      {/* zone cliquable plein cadre (sous le cœur) */}
      <Link
        href={href ?? `/groups/${group.slug}`}
        aria-label={group.name}
        className="focus-visible:ring-ring/60 absolute inset-0 rounded-xl outline-none focus-visible:ring-2"
      />

      <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate p-3 font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
        {group.name}
      </span>

      <div className="absolute top-2 right-2 z-10">
        <FollowButton
          groupId={group.id}
          initialFollowing={isFollowing}
          isAuthed={isAuthed}
          iconOnly
        />
      </div>
    </div>
  )
}
