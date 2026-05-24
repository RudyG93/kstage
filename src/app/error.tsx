'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="space-y-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">Something went wrong loading this page.</p>
      <button type="button" onClick={reset} className="text-sm underline underline-offset-4">
        Try again
      </button>
    </div>
  )
}
