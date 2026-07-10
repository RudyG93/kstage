'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogContent({ className, children, ...props }: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        // max-h + overflow : un dialog fixed plus haut que le viewport est
        // irrécupérable au scroll de page (Submit hors écran sur mobile —
        // onglet Artist de « Contribute », audit 2026-07-10). 100dvh, pas
        // 100vh : la barre d'URL mobile mange la différence.
        className={cn(
          'bg-card text-card-foreground border border-border fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl p-6 shadow-xl outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        {/* Fermeture visible : Escape n'existe pas au tactile et le backdrop
            peut être entièrement recouvert quand le contenu est long. */}
        <DialogPrimitive.Close
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-4 right-4 rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn('font-heading text-lg font-bold', className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Dialog, DialogTrigger, DialogClose, DialogContent, DialogTitle, DialogDescription }
