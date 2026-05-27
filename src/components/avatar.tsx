function getInitials(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local.slice(0, 2).toUpperCase()
}

export function Avatar({ email, size = 32 }: { email: string; size?: number }) {
  return (
    <div
      className="gradient-signature flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {getInitials(email)}
    </div>
  )
}
