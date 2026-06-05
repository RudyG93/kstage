'use client'

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

const boxClass =
  'h-12 w-10 rounded-lg border bg-background text-center font-mono text-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60'

/**
 * Saisie OTP en cases séparées (§1.2) — pattern Discord/Twitch, sans dépendance.
 * Auto-focus sur la case suivante, retour arrière intelligent, paste auto-fill.
 * Un input caché `name` porte la valeur jointe pour la soumission du form.
 */
export function OtpInput({
  length = 6,
  name,
  disabled,
  invalid,
}: {
  length?: number
  name: string
  disabled?: boolean
  invalid?: boolean
}) {
  const [digits, setDigits] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<(HTMLInputElement | null)[]>([])

  const focusBox = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  function setAt(i: number, value: string) {
    setDigits((prev) => {
      const next = [...prev]
      next[i] = value
      return next
    })
  }

  function handleChange(i: number, raw: string) {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) {
      setAt(i, '')
      return
    }
    setAt(i, digit)
    if (i < length - 1) focusBox(i + 1)
  }

  function handleKeyDown(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setAt(i, '')
      } else if (i > 0) {
        e.preventDefault()
        setAt(i - 1, '')
        focusBox(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      focusBox(i - 1)
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault()
      focusBox(i + 1)
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!pasted) return
    e.preventDefault()
    const next = Array.from({ length }, (_, i) => pasted[i] ?? '')
    setDigits(next)
    focusBox(Math.min(pasted.length, length - 1))
  }

  return (
    <div className="flex justify-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={d}
          disabled={disabled}
          aria-invalid={invalid}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          className={boxClass}
        />
      ))}
      <input type="hidden" name={name} value={digits.join('')} />
    </div>
  )
}
