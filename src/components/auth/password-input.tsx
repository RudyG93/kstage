'use client'

import { useState } from 'react'
import { EyeIcon, EyeOffIcon } from 'lucide-react'

const inputClass =
  'h-9 w-full rounded-lg border bg-background pl-3 pr-9 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * Champ mot de passe avec toggle voir/cacher (§1.1). Chaque instance gère sa
 * propre visibilité — utilisable indépendamment sur password et confirm.
 */
export function PasswordInput({
  id,
  name,
  autoComplete,
  required,
  minLength,
}: {
  id: string
  name: string
  autoComplete: string
  required?: boolean
  minLength?: number
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        className={inputClass}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-lg outline-none focus-visible:ring-3"
      >
        {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  )
}
