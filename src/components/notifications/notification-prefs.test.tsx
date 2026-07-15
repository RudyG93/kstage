// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/notifications/actions', () => ({ setNotificationPref: vi.fn() }))
vi.mock('@/lib/notifications/subscribe', () => ({
  getExistingSubscription: vi.fn(() => new Promise(() => {})),
}))

import { NotificationPrefs } from './notification-prefs'

describe('NotificationPrefs', () => {
  it('shows only launch-supported event categories', () => {
    render(
      <NotificationPrefs
        initial={{ mv: true, release: true, music_show: true, anniversary: true, live: true }}
      />,
    )

    for (const label of ['MV drops', 'Releases', 'Music shows', 'Birthdays & anniversaries']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText('Lives')).not.toBeInTheDocument()
    expect(screen.queryByText(/scheduled premieres and lives/i)).not.toBeInTheDocument()
  })
})
