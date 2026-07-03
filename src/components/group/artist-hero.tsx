import type { ReactNode } from 'react'
import Image from 'next/image'
import { BackButton } from '@/components/back-button'
import { ShareButton } from '@/components/share-button'

// Bannière Data Desk 210px (§7.6.1) : image (fallback gradient color_hex 150deg
// + monogramme géant), boutons back/share flottants, tags + nom 30/800 + méta,
// slot follow (pilule).
export function ArtistHero({
  name,
  image,
  colorHex,
  tags,
  meta,
  follow,
}: {
  name: string
  image: string | null
  colorHex?: string | null
  tags?: ReactNode
  meta?: string | null
  follow?: ReactNode
}) {
  return (
    <div className="relative h-[210px] overflow-hidden md:rounded-xl">
      {image ? (
        <Image
          src={image}
          alt=""
          aria-hidden
          fill
          unoptimized
          sizes="(min-width: 768px) 672px, 100vw"
          className="object-cover object-center"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={
            colorHex
              ? {
                  background: `linear-gradient(150deg, ${colorHex} 0%, ${colorHex}99 50%, ${colorHex}55 100%)`,
                }
              : undefined
          }
          aria-hidden
        >
          {!colorHex && <span className="gradient-signature absolute inset-0" />}
          <span className="font-heading absolute -right-2 -bottom-8 text-[150px] leading-none font-extrabold text-white/10 select-none">
            {name.slice(0, 2)}
          </span>
        </div>
      )}
      {/* Scrim bas vers --page. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, transparent 40%, color-mix(in srgb, var(--page) 70%, transparent))',
        }}
        aria-hidden
      />
      <BackButton className="absolute top-3 left-3 z-10" />
      <ShareButton title={name} className="absolute top-3 right-3 z-10" />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        <div className="min-w-0">
          {tags && <div className="flex flex-wrap items-center gap-1.5">{tags}</div>}
          <h1
            className="font-heading mt-1.5 truncate text-[30px] leading-tight font-extrabold tracking-[-0.02em]"
            style={{ textShadow: '0 2px 16px color-mix(in srgb, var(--page) 60%, transparent)' }}
          >
            {name}
          </h1>
          {meta && (
            <p className="text-muted-foreground truncate text-[10.5px] font-medium">{meta}</p>
          )}
        </div>
        {follow && <div className="shrink-0 pb-1">{follow}</div>}
      </div>
    </div>
  )
}
