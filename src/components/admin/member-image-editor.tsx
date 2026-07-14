'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { faceCrop } from '@/lib/images/cloudinary'
import { setMemberPhoto } from '@/lib/members/actions'

export type AdminMember = {
  id: string
  name: string
  group: string
  photo: string | null
  source: string | null
}

/**
 * Éditeur de photo membre (admin) : recherche → colle une URL d'image → aperçu
 * live → self-host via setMemberPhoto. Filtre client sur ~700 membres.
 */
export function MemberImageEditor({ members }: { members: AdminMember[] }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return members.slice(0, 30)
    return members
      .filter((m) => m.name.toLowerCase().includes(n) || m.group.toLowerCase().includes(n))
      .slice(0, 30)
  }, [members, q])

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher un membre ou un groupe…"
        className="border-input bg-background focus-visible:ring-ring/50 h-10 w-full rounded-lg border px-3 text-base outline-none focus-visible:ring-2 md:text-sm"
      />
      <ul className="divide-y rounded-xl border">
        {filtered.length === 0 ? (
          <li className="text-muted-foreground px-3 py-4 text-sm">Aucun membre.</li>
        ) : (
          filtered.map((m) => <MemberRow key={m.id} member={m} />)
        )}
      </ul>
    </div>
  )
}

function MemberRow({ member }: { member: AdminMember }) {
  const [url, setUrl] = useState('')
  const [photo, setPhoto] = useState(member.photo)
  const [source, setSource] = useState(member.source)
  const [pending, startTransition] = useTransition()

  function save() {
    const clean = url.trim()
    if (!clean) return
    startTransition(async () => {
      const res = await setMemberPhoto(member.id, clean)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      setPhoto(res.photoUrl)
      setSource('admin')
      setUrl('')
      toast.success(`${member.name} — photo mise à jour`)
    })
  }

  const preview = url.trim() || (photo ? faceCrop(photo, 96, 96) : null)

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="bg-muted relative size-11 shrink-0 overflow-hidden rounded-lg">
        {preview && (
          <Image
            src={preview}
            alt=""
            fill
            unoptimized
            sizes="44px"
            className="object-cover"
            aria-hidden
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{member.name}</span>
        <span className="text-muted-foreground block truncate text-xs">
          {member.group}
          {source === 'admin' && ' · manuel'}
        </span>
      </span>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="URL image…"
        className="border-input bg-background focus-visible:ring-ring/50 h-9 w-40 rounded-lg border px-2.5 text-xs outline-none focus-visible:ring-2 md:w-52"
      />
      <Button type="button" size="sm" onClick={save} disabled={pending || !url.trim()}>
        {pending ? '…' : 'Set'}
      </Button>
    </li>
  )
}
