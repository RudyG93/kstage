import Link from 'next/link'

export default function MvNotFound() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">MV not found</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        This music video doesn&apos;t exist or has been removed.
      </p>
      <Link
        href="/"
        className="text-primary mt-6 inline-block text-sm underline-offset-2 hover:underline"
      >
        ← Back to KStage
      </Link>
    </div>
  )
}
