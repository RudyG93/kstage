'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Avatar } from '@/components/avatar'
import { AvatarCropper } from '@/components/account/avatar-cropper'
import { updateAvatar } from '@/lib/profiles/actions'

// PP du profil (owner) : cliquable → modale de recadrage, upload optimiste.
export function ProfileAvatar({
  email,
  username,
  avatarUrl,
}: {
  email: string | null
  username: string | null
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(avatarUrl)
  const [pending, start] = useTransition()

  function handleCropped(blob: Blob) {
    const localUrl = URL.createObjectURL(blob)
    const previous = current
    setCurrent(localUrl) // aperçu optimiste
    start(async () => {
      const fd = new FormData()
      fd.append('avatar', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      const res = await updateAvatar(fd)
      URL.revokeObjectURL(localUrl)
      if ('error' in res) {
        setCurrent(previous)
        toast.error(res.error)
        return
      }
      setCurrent(res.avatarUrl)
      router.refresh() // met à jour l'avatar du header
    })
  }

  return (
    <AvatarCropper
      onCropped={handleCropped}
      triggerClassName="group focus-visible:ring-ring/50 relative shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-3"
    >
      <Avatar
        email={email ?? undefined}
        username={username ?? undefined}
        avatarUrl={current}
        size={64}
      />
      <span className="absolute inset-0 flex items-center justify-center rounded-full text-xs font-medium text-white opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
        {pending ? 'Saving…' : 'Change'}
      </span>
    </AvatarCropper>
  )
}
