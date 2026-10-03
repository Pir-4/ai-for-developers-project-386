import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '../src/App.tsx'
import { landingCopy } from '../src/content/landing.ts'
import { LandingLocaleProvider } from '../src/i18n.tsx'

// Target English copy. Spec § 6.1 delegates exact EN wording to the constants
// and to human review; these tests prove the rendered page switches to that
// dictionary coherently (never a mix of locales).
const en = landingCopy.en

function renderLanding() {
  return render(
    <MantineProvider>
      <LandingLocaleProvider>
        <App />
      </LandingLocaleProvider>
    </MantineProvider>,
  )
}

function localeButton(name: 'RU' | 'EN') {
  return within(screen.getByRole('banner')).getByRole('button', { name })
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute('lang')
})

describe('language switcher (spec § 6.1)', () => {
  it('starts in Russian by default', () => {
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      landingCopy.ru.hero.title,
    )
    expect(document.documentElement).toHaveAttribute('lang', 'ru')
  })

  it('exposes RU and EN buttons in the header, always visible', () => {
    renderLanding()
    expect(localeButton('RU')).toBeInTheDocument()
    expect(localeButton('EN')).toBeInTheDocument()
  })

  it('switches the whole page to English on click', async () => {
    const user = userEvent.setup()
    renderLanding()
    await user.click(localeButton('EN'))

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      en.hero.title,
    )
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s[0]).toHaveTextContent(en.how.heading)
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: en.nav.how }),
    ).toHaveAttribute('href', '#how')
    expect(
      within(banner).getByRole('link', { name: en.createMeeting }),
    ).toHaveAttribute('href', '#cta')
  })

  it('keeps anchor ids and hrefs unchanged across a switch', async () => {
    const user = userEvent.setup()
    renderLanding()
    const mainBefore = screen.getByRole('main')
    const idsBefore = [...mainBefore.querySelectorAll('section[id]')].map(
      (el) => el.id,
    )
    await user.click(localeButton('EN'))
    const mainAfter = screen.getByRole('main')
    const idsAfter = [...mainAfter.querySelectorAll('section[id]')].map(
      (el) => el.id,
    )
    expect(idsAfter).toEqual(idsBefore)
    expect(idsAfter).toEqual(['how', 'audiences', 'cta'])
  })

  it('reflects the active locale in <html lang>', async () => {
    const user = userEvent.setup()
    renderLanding()
    expect(document.documentElement).toHaveAttribute('lang', 'ru')
    await user.click(localeButton('EN'))
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    await user.click(localeButton('RU'))
    expect(document.documentElement).toHaveAttribute('lang', 'ru')
  })

  it('persists the choice to localStorage and restores it on remount', async () => {
    const user = userEvent.setup()
    const first = renderLanding()
    await user.click(localeButton('EN'))
    expect(window.localStorage.getItem('ui.locale')).toBe('en')
    first.unmount()

    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      en.hero.title,
    )
  })

  it('falls back to Russian when localStorage holds an unknown locale', () => {
    window.localStorage.setItem('ui.locale', 'klingon')
    renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      landingCopy.ru.hero.title,
    )
    expect(document.documentElement).toHaveAttribute('lang', 'ru')
  })

  it('keeps the structural contract in English (spec § 8.9)', async () => {
    const user = userEvent.setup()
    renderLanding()
    await user.click(localeButton('EN'))

    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0]).toHaveTextContent(en.hero.title)
    const h2s = screen.getAllByRole('heading', { level: 2 })
    expect(h2s.map((h) => h.textContent)).toEqual([
      en.how.heading,
      en.audiences.heading,
      en.cta.heading,
    ])
    const meetingLinks = screen.getAllByRole('link', {
      name: en.createMeeting,
    })
    expect(meetingLinks).toHaveLength(3)
    for (const link of meetingLinks) {
      expect(link).toHaveAttribute('href', '#cta')
    }
  })

  it('marks the active locale button with aria-pressed', async () => {
    const user = userEvent.setup()
    renderLanding()
    expect(localeButton('RU')).toHaveAttribute('aria-pressed', 'true')
    expect(localeButton('EN')).toHaveAttribute('aria-pressed', 'false')
    await user.click(localeButton('EN'))
    expect(localeButton('EN')).toHaveAttribute('aria-pressed', 'true')
    expect(localeButton('RU')).toHaveAttribute('aria-pressed', 'false')
  })
})
