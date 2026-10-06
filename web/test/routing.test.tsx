import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { appCopy } from '../src/content/app.ts'
import { landingCopy } from '../src/content/landing.ts'
import { LocaleProvider } from '../src/i18n.tsx'

const ru = appCopy.ru
const en = appCopy.en
const ruLanding = landingCopy.ru

// Любой рендер App дергает fetch (доступность, слоты, встречи) — стаб по умолчанию: пустой список.
function stubFetch(respond: () => Response = emptyList) {
  vi.stubGlobal('fetch', vi.fn(async () => respond()))
}

function emptyList(): Response {
  return json(200, [])
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderApp(path = '/') {
  window.history.pushState({}, '', path)
  return render(
    <MantineProvider>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </MantineProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('клиентские роуты', () => {
  it('/ рендерит лендинг', () => {
    stubFetch()
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Запись на звонок за 30 секунд',
    )
  })

  it('/login рендерит форму входа', () => {
    stubFetch()
    renderApp('/login')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.login.title,
    )
    expect(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: ru.login.submit }),
    ).toBeInTheDocument()
  })

  it('голый /owner редиректит на /login', () => {
    stubFetch()
    renderApp('/owner')
    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.login.title,
    )
  })

  it('/owner/:email рендерит кабинет владельца', () => {
    stubFetch()
    renderApp('/owner/owner@example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.owner.title,
    )
    for (const section of [
      ru.owner.calendarTitle,
      ru.owner.guestLinkTitle,
      ru.owner.meetingsTitle,
    ]) {
      expect(
        screen.getByRole('heading', { level: 2, name: section }),
      ).toBeInTheDocument()
    }
  })

  it('/book/:email рендерит календарь владельца для гостя', async () => {
    stubFetch()
    renderApp('/book/owner@example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guest.title,
    )
    expect(screen.getByText('owner@example.com')).toBeInTheDocument()
    for (const section of [ru.guest.dayLabel, ru.guest.timeLabel]) {
      expect(
        screen.getByRole('heading', { level: 3, name: section }),
      ).toBeInTheDocument()
    }
    // Длительности 15/30/45 — выбор гостя, а не типы встреч владельца.
    for (const minutes of [15, 30, 45]) {
      expect(
        screen.getByRole('radio', { name: `${minutes} мин` }),
      ).toBeInTheDocument()
    }
    expect(await screen.findByText(ru.guest.noAvailability)).toBeInTheDocument()
  })

  it('неизвестный путь — страница «не найдено»', () => {
    stubFetch()
    renderApp('/no-such-page')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.notFound.title,
    )
    expect(
      screen.getByRole('link', { name: ru.notFound.toMain }),
    ).toHaveAttribute('href', '/')
  })
})

describe('вход по email (логин)', () => {
  it('валидный email: переход в зону владельца, email запомнен', async () => {
    stubFetch()
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
      'owner@example.com',
    )
    await user.click(screen.getByRole('button', { name: ru.login.submit }))

    expect(window.location.pathname).toBe('/owner/owner%40example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.owner.title,
    )
    expect(window.localStorage.getItem('owner.email')).toBe(
      'owner@example.com',
    )
  })

  it('невалидный email: ошибка, без перехода', async () => {
    stubFetch()
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
      'не-email',
    )
    await user.click(screen.getByRole('button', { name: ru.login.submit }))

    expect(screen.getByText(ru.login.invalidEmail)).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(window.localStorage.getItem('owner.email')).toBeNull()
  })

  it('последний email подставляется при возврате', () => {
    stubFetch()
    window.localStorage.setItem('owner.email', 'saved@example.com')
    renderApp('/login')
    expect(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
    ).toHaveValue('saved@example.com')
  })
})

describe('шапка: вход в «Мои встречи»', () => {
  it('без запомненного email показывает «Создать встречу» → /owner', () => {
    stubFetch()
    renderApp('/')
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: ruLanding.createMeeting }),
    ).toHaveAttribute('href', '/owner')
    expect(
      within(banner).queryByRole('link', { name: ruLanding.myMeetings }),
    ).not.toBeInTheDocument()
  })

  it('с запомненным email показывает «Мои встречи» → /owner/<email>', () => {
    stubFetch()
    window.localStorage.setItem('owner.email', 'saved@example.com')
    renderApp('/')
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: ruLanding.myMeetings }),
    ).toHaveAttribute('href', '/owner/saved%40example.com')
    expect(
      within(banner).queryByRole('link', { name: ruLanding.createMeeting }),
    ).not.toBeInTheDocument()
  })

  it('после входа по email шапка сразу переключается на «Мои встречи»', async () => {
    stubFetch()
    const user = userEvent.setup()
    renderApp('/login')
    await user.type(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
      'owner@example.com',
    )
    await user.click(screen.getByRole('button', { name: ru.login.submit }))

    const banner = screen.getByRole('banner')
    expect(
      await within(banner).findByRole('link', {
        name: ruLanding.myMeetings,
      }),
    ).toHaveAttribute('href', '/owner/owner%40example.com')
  })
})

describe('переключатель языка на каждой странице', () => {
  it.each([
    '/login',
    '/owner/owner@example.com',
    '/book/owner@example.com',
  ])('%s: RU/EN переключают язык страницы', async (path) => {
    stubFetch()
    const user = userEvent.setup()
    renderApp(path)

    const banner = screen.getByRole('banner')
    await user.click(within(banner).getByRole('button', { name: 'EN' }))

    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      path.startsWith('/login')
        ? en.login.title
        : path.startsWith('/owner')
          ? en.owner.title
          : en.guest.title,
    )
  })
})
