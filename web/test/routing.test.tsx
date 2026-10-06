import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'

const ru = appCopy.ru
const en = appCopy.en

// Любой рендер App дергает fetch (список типов встречи) — стаб по умолчанию: пустой список.
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

  it('/owner/:email рендерит зону владельца', () => {
    stubFetch()
    renderApp('/owner/owner@example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.owner.title,
    )
    expect(
      screen.getByRole('heading', { level: 2, name: ru.owner.formTitle }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 2, name: ru.owner.listTitle }),
    ).toBeInTheDocument()
  })

  it('/book/:email рендерит каталог типов встреч владельца со ссылками на календарь', async () => {
    stubFetch(() =>
      json(200, [
        {
          id: 1,
          ownerEmail: 'owner@example.com',
          name: 'Знакомство',
          description: 'Первый созвон',
          duration: 30,
        },
      ]),
    )
    renderApp('/book/owner@example.com')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guestCatalog.title,
    )
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Знакомство' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Первый созвон')).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Знакомство/ })).toHaveAttribute(
      'href',
      '/book/owner%40example.com/1',
    )
  })

  it('/book/:email: у владельца нет типов встреч — пустое состояние', async () => {
    stubFetch()
    renderApp('/book/owner@example.com')
    expect(await screen.findByText(ru.guestCatalog.empty)).toBeInTheDocument()
  })

  it('/book/:email/:id рендерит страницу гостя', async () => {
    stubFetch(() =>
      json(200, [
        {
          id: 1,
          ownerEmail: 'owner@example.com',
          name: 'Знакомство',
          description: 'Первый созвон',
          duration: 30,
        },
      ]),
    )
    renderApp('/book/owner@example.com/1')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      ru.guest.title,
    )
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Знакомство' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: ru.guest.dayLabel }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 3, name: ru.guest.timeLabel }),
    ).toBeInTheDocument()
  })

  it('/book/:email/:id: несуществующий тип — notFound', async () => {
    stubFetch()
    renderApp('/book/owner@example.com/999')
    expect(await screen.findByText(ru.guest.notFound)).toBeInTheDocument()
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

describe('переключатель языка на каждой странице', () => {
  it.each([
    '/login',
    '/owner/owner@example.com',
    '/book/owner@example.com',
    '/book/owner@example.com/1',
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
          : path === '/book/owner@example.com'
            ? en.guestCatalog.title
            : en.guest.title,
    )
  })
})
