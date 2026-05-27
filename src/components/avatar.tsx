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
        className="shrink-0 rounded-full object-cover"
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
