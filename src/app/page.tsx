import { Button } from '@/components/ui/button'

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen items-center justify-center">
      <div className="space-y-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">KStage</h1>
        <p className="text-muted-foreground">Your k-pop calendar — coming soon.</p>
        <Button>Notify me</Button>
      </div>
    </main>
  )
}
