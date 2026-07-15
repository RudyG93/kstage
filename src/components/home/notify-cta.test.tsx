// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/follows/actions', () => ({ toggleFollow: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { toggleFollow } from '@/lib/follows/actions'
import { toast } from 'sonner'
import { NotifyCta } from './notify-cta'

const toggleFollowMock = vi.mocked(toggleFollow)
const toastErrorMock = vi.mocked(toast.error)

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('NotifyCta', () => {
  beforeEach(() => {
    toggleFollowMock.mockReset()
    toastErrorMock.mockReset()
  })

  it('sends signed-out users to login with truthful copy', () => {
    render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed={false} />)

    const link = screen.getByRole('link', { name: 'Follow' })
    expect(link).toHaveAttribute('href', '/login')
    expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText(/notify/i)).not.toBeInTheDocument()
  })

  it.each([
    {
      initialFollowing: false,
      initialLabel: 'Follow',
      optimisticLabel: 'Following',
      optimisticPressed: 'true',
    },
    {
      initialFollowing: true,
      initialLabel: 'Following',
      optimisticLabel: 'Follow',
      optimisticPressed: 'false',
    },
  ])(
    'toggles from $initialLabel with the current-state action argument',
    async ({ initialFollowing, initialLabel, optimisticLabel, optimisticPressed }) => {
      const request = deferred<void>()
      toggleFollowMock.mockReturnValueOnce(request.promise)
      const user = userEvent.setup()
      render(<NotifyCta groupId="g1" initialFollowing={initialFollowing} isAuthed />)

      const initialButton = screen.getByRole('button', { name: initialLabel })
      expect(initialButton).toHaveAttribute('aria-pressed', String(initialFollowing))
      expect(initialButton.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')

      await user.click(initialButton)

      const optimisticButton = screen.getByRole('button', { name: optimisticLabel })
      expect(optimisticButton).toHaveAttribute('aria-pressed', optimisticPressed)
      expect(optimisticButton).toBeDisabled()
      expect(toggleFollowMock).toHaveBeenCalledWith('g1', initialFollowing)

      await user.click(optimisticButton)
      expect(toggleFollowMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        request.resolve(undefined)
        await request.promise
      })
    },
  )

  it('keeps the newly confirmed state after server reconciliation', async () => {
    const request = deferred<void>()
    toggleFollowMock.mockReturnValueOnce(request.promise)
    const user = userEvent.setup()
    const { rerender } = render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed />)

    await user.click(screen.getByRole('button', { name: 'Follow' }))
    rerender(<NotifyCta groupId="g1" initialFollowing isAuthed />)

    await act(async () => {
      request.resolve(undefined)
      await request.promise
    })

    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Following' })
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(button).not.toBeDisabled()
    })
  })

  it('rolls back and reports a generic error when the mutation fails', async () => {
    const request = deferred<void>()
    toggleFollowMock.mockReturnValueOnce(request.promise)
    const user = userEvent.setup()
    render(<NotifyCta groupId="g1" initialFollowing={false} isAuthed />)

    await user.click(screen.getByRole('button', { name: 'Follow' }))
    expect(screen.getByRole('button', { name: 'Following' })).toBeDisabled()

    await act(async () => {
      request.reject(new Error('database detail'))
      await request.promise.catch(() => undefined)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Follow' })).not.toBeDisabled()
      expect(toastErrorMock).toHaveBeenCalledWith("Couldn't update follow — please try again.")
    })
  })
})
