import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { appCopy } from '../src/content/app.ts'
import { landingCopy } from '../src/content/landing.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { json, stubFetch } from './fetch-stub.ts'

const ru = appCopy.ru
const en = appCopy.en
const ruLanding = landingCopy.ru

// Любой рендер App дергает API (доступность, типы, слоты, встречи) — стаб по
// умолчанию: пустые списки, а конкретного типа встречи нет (404).
function stubApi() {
  stubFetch(({ url }) =>
    /\/event-types\/\d+$/.test(url)
      ? json(404, { message: 'event type not found' })
      : json(200, []),
  )
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
    stubApi()
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Запись на звонок за 30 секунд',
    )
  })

  it('/login рендерит форму входа', () => {
    stubApi()
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
    stubApi()
    renderApp('/owner')
    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.login.title,
    )
  })

  it('/owner/:email рендерит кабинет владельца', () => {
    stubApi()
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

  it('/book/:email рендерит каталог типов встреч владельца', async () => {
    stubApi()
    renderApp('/book/owner@example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guestCatalog.title,
    )
    expect(screen.getByText(/owner@example\.com/)).toBeInTheDocument()
    expect(await screen.findByText(ru.guestCatalog.empty)).toBeInTheDocument()
  })

  it('/book/:email/:eventTypeId рендерит запись на тип встречи', async () => {
    stubApi()
    renderApp('/book/owner@example.com/5')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guest.title,
    )
    for (const section of [ru.guest.dayLabel, ru.guest.timeLabel]) {
      expect(
        screen.getByRole('heading', { level: 3, name: section }),
      ).toBeInTheDocument()
    }
    // Тип не найден — гость видит это, а не пустой календарь.
    expect(await screen.findByText(ru.guest.eventTypeNotFound)).toBeInTheDocument()
  })

  it('неизвестный путь — страница «не найдено»', () => {
    stubApi()
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
    stubApi()
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
    stubApi()
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
    stubApi()
    window.localStorage.setItem('owner.email', 'saved@example.com')
    renderApp('/login')
    expect(
      screen.getByRole('textbox', { name: ru.login.emailLabel }),
    ).toHaveValue('saved@example.com')
  })
})

describe('шапка: вход в «Мои встречи»', () => {
  it('без запомненного email показывает «Создать встречу» → /owner', () => {
    stubApi()
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
    stubApi()
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
    stubApi()
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
    '/book/owner@example.com/5',
  ])('%s: RU/EN переключают язык страницы', async (path) => {
    stubApi()
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
          : path === '/book/owner@example.com'
            ? en.guestCatalog.title
            : en.guest.title,
    )
  })
})
