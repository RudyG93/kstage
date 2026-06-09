import Image from 'next/image'

function getInitials(source: string): string {
  const base = source.includes('@') ? (source.split('@')[0] ?? '') : source
  return base.slice(0, 2).toUpperCase() || '?'
}

export function Avatar({
  email,
  username,
  avatarUrl,
  size = 32,
}: {
  email?: string
  username?: string
  avatarUrl?: string | null
  size?: number
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        // `unoptimized` (§5) : les photos membres viennent de hosts externes
        // hétérogènes (up.kpop.re, ygfamily.com, …) non whitelistés dans
        // next.config → l'optimiseur Next renvoie 400 et l'avatar casse (bug
        // bias). À taille avatar (≤112px) le gain d'optimisation est nul.
        // Même choix que MemberCard.
        unoptimized
        // `max-w-none` est requis : Tailwind Preflight applique `max-width: 100%`
        // à toute <img>. Quand l'avatar est un flex-item (header) dont la largeur
        // dépend de son contenu, ce `max-width: 100%` se résout contre une largeur
        // parente de 0 et écrase la largeur fixe → avatar invisible (largeur 0).
        className="max-w-none shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className="gradient-signature flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {getInitials(username || email || '?')}
    </div>
  )
}
