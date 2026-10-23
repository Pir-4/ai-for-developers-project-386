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

const owner = { name: 'Анна Смирнова', email: 'anna@example.com' }

// Любой рендер App дергает API (владелец, доступность, типы, слоты, встречи) —
// стаб по умолчанию: профиль владельца, пустые списки, а конкретного типа
// встречи нет (404).
function stubApi() {
  stubFetch(({ url }) =>
    url.endsWith('/api/owner')
      ? json(200, owner)
      : /\/event-types\/\d+$/.test(url)
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

  it('/login больше не существует — входа нет', () => {
    stubApi()
    renderApp('/login')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.notFound.title,
    )
  })

  it('/owner рендерит кабинет единственного владельца без входа', async () => {
    stubApi()
    renderApp('/owner')
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
    expect(await screen.findByText(/anna@example\.com/)).toBeInTheDocument()
  })

  it('/book рендерит каталог типов встреч владельца', async () => {
    stubApi()
    renderApp('/book')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guestCatalog.title,
    )
    expect(await screen.findByText(new RegExp(owner.name))).toBeInTheDocument()
    expect(await screen.findByText(ru.guestCatalog.empty)).toBeInTheDocument()
  })

  it('/book/:eventTypeId рендерит запись на тип встречи', async () => {
    stubApi()
    renderApp('/book/5')
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

describe('шапка и лендинг ведут гостя к записи', () => {
  it('кнопка в шапке «Записаться на звонок» → /book', () => {
    stubApi()
    renderApp('/')
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: ruLanding.bookCall }),
    ).toHaveAttribute('href', '/book')
  })

  it('все кнопки «Записаться на звонок» на лендинге ведут на /book', () => {
    stubApi()
    renderApp('/')
    const main = screen.getByRole('main')
    const links = within(main).getAllByRole('link', { name: ruLanding.bookCall })
    expect(links.length).toBeGreaterThan(0)
    for (const link of links) expect(link).toHaveAttribute('href', '/book')
  })

  it('кабинет владельца — вторичная ссылка на /owner', () => {
    stubApi()
    renderApp('/')
    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('link', { name: ruLanding.ownerArea }),
    ).toHaveAttribute('href', '/owner')
  })

  it('клик по главной кнопке открывает каталог типов встреч', async () => {
    stubApi()
    const user = userEvent.setup()
    renderApp('/')
    const main = screen.getByRole('main')
    await user.click(within(main).getAllByRole('link', { name: ruLanding.bookCall })[0]!)
    expect(window.location.pathname).toBe('/book')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guestCatalog.title,
    )
  })
})

describe('переключатель языка на каждой странице', () => {
  it.each([
    '/owner',
    '/book',
    '/book/5',
  ])('%s: RU/EN переключают язык страницы', async (path) => {
    stubApi()
    const user = userEvent.setup()
    renderApp(path)

    const banner = screen.getByRole('banner')
    await user.click(within(banner).getByRole('button', { name: 'EN' }))

    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      path === '/owner'
        ? en.owner.title
        : path === '/book'
          ? en.guestCatalog.title
          : en.guest.title,
    )
  })
})
