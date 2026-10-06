import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { guestHref } from '../src/links.ts'
import type { EventType } from '../src/api.ts'

const ru = appCopy.ru

const ownerEmail = 'owner@example.com'
const apiUrl = `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const existing: EventType = {
  id: 1,
  ownerEmail,
  name: 'Знакомство',
  description: 'Первый созвон: знакомимся и обсуждаем идеи',
  duration: 30,
}

const created: EventType = {
  id: 5,
  ownerEmail,
  name: 'Карьерный разбор',
  description: 'Смотрим резюме и план роста',
  duration: 45,
}

// Стаб fetch: маршруты (method + url) → Response; прочее — ошибка теста.
function stubFetch(
  routes: { method?: string; url?: string; respond: () => Response }[],
) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const route = routes.find(
      (candidate) =>
        (candidate.method ?? 'GET') === method &&
        (candidate.url ?? apiUrl) === url,
    )
    if (!route) {
      throw new Error(`нет стаба для ${method} ${url}`)
    }
    return route.respond()
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

// jsdom без clipboard API — подменяем, CopyButton пишет сюда.
function stubClipboard(): ReturnType<typeof vi.fn> {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  return writeText
}

function renderOwnerPage() {
  window.history.pushState({}, '', `/owner/${encodeURIComponent(ownerEmail)}`)
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

describe('зона владельца: список типов встреч', () => {
  it('показывает существующие типы со ссылкой для гостя', async () => {
    stubFetch([{ respond: () => json(200, [existing]) }])
    renderOwnerPage()

    expect(
      await screen.findByRole('heading', { level: 3, name: existing.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(existing.description)).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()

    const url = `${window.location.origin}${guestHref(ownerEmail, existing.id)}`
    expect(screen.getByText(url)).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: ru.owner.copy }).length,
    ).toBeGreaterThan(0)
  })

  it('пустой список — подсказка', async () => {
    stubFetch([{ respond: () => json(200, []) }])
    renderOwnerPage()
    expect(await screen.findByText(ru.owner.empty)).toBeInTheDocument()
  })

  it('ошибка загрузки — сообщение', async () => {
    stubFetch([{ respond: () => new Response('boom', { status: 500 }) }])
    renderOwnerPage()
    expect(await screen.findByText(ru.owner.loadError)).toBeInTheDocument()
  })
})

describe('зона владельца: создание типа встречи', () => {
  async function fillForm(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      screen.getByRole('textbox', { name: ru.owner.nameLabel }),
      created.name,
    )
    await user.type(
      screen.getByRole('textbox', { name: ru.owner.descriptionLabel }),
      created.description,
    )
    // длительность: 30 (значение по умолчанию) → 45
    await user.clear(
      screen.getByRole('textbox', { name: ru.owner.durationLabel }),
    )
    await user.type(
      screen.getByRole('textbox', { name: ru.owner.durationLabel }),
      '45',
    )
  }

  it('клиентская валидация не пускает пустую форму на сервер', async () => {
    const fetchMock = stubFetch([{ respond: () => json(200, []) }])
    const user = userEvent.setup()
    renderOwnerPage()
    await screen.findByText(ru.owner.empty)

    await user.clear(screen.getByRole('textbox', { name: ru.owner.nameLabel }))
    await user.clear(
      screen.getByRole('textbox', { name: ru.owner.descriptionLabel }),
    )
    await user.click(screen.getByRole('button', { name: ru.owner.create }))

    expect(screen.getByText(ru.owner.nameRequired)).toBeInTheDocument()
    expect(screen.getByText(ru.owner.descriptionRequired)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      apiUrl,
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('клиентская валидация ловит некратную 15 длительность', async () => {
    stubFetch([{ respond: () => json(200, []) }])
    const user = userEvent.setup()
    renderOwnerPage()
    await screen.findByText(ru.owner.empty)

    await user.type(
      screen.getByRole('textbox', { name: ru.owner.nameLabel }),
      created.name,
    )
    await user.type(
      screen.getByRole('textbox', { name: ru.owner.descriptionLabel }),
      created.description,
    )
    const durationInput = screen.getByRole('textbox', {
      name: ru.owner.durationLabel,
    })
    await user.clear(durationInput)
    await user.type(durationInput, '42')
    await user.click(screen.getByRole('button', { name: ru.owner.create }))

    expect(screen.getByText(ru.owner.durationInvalid)).toBeInTheDocument()
  })

  it('показывает ошибки сервера (422) по полям', async () => {
    stubFetch([
      { respond: () => json(200, []) },
      {
        method: 'POST',
        respond: () =>
          json(422, {
            message: 'body/body must be multiple of 15',
            errors: [{ path: 'duration', message: 'must be multiple of 15' }],
          }),
      },
    ])
    const user = userEvent.setup()
    renderOwnerPage()
    await screen.findByText(ru.owner.empty)

    await user.type(
      screen.getByRole('textbox', { name: ru.owner.nameLabel }),
      created.name,
    )
    await user.type(
      screen.getByRole('textbox', { name: ru.owner.descriptionLabel }),
      created.description,
    )
    await user.click(screen.getByRole('button', { name: ru.owner.create }))

    expect(
      await screen.findByText('must be multiple of 15'),
    ).toBeInTheDocument()
  })

  it('успех: новый тип появляется со ссылкой для гостя и рабочей копией', async () => {
    const fetchMock = stubFetch([
      { respond: () => json(200, []) },
      { method: 'POST', respond: () => json(201, created) },
    ])
    const user = userEvent.setup()
    // userEvent.setup() подменяет navigator.clipboard своей заглушкой —
    // поэтому наш стаб ставим после него.
    const writeText = stubClipboard()
    renderOwnerPage()
    await screen.findByText(ru.owner.empty)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: ru.owner.create }))

    // POST ушел с телом из формы
    expect(fetchMock).toHaveBeenCalledWith(
      apiUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: created.name,
          description: created.description,
          duration: created.duration,
        }),
      }),
    )

    // карточка созданного типа со ссылкой
    expect(
      await screen.findByRole('heading', { level: 3, name: created.name }),
    ).toBeInTheDocument()
    const url = `${window.location.origin}${guestHref(ownerEmail, created.id)}`
    expect(screen.getByText(url)).toBeInTheDocument()

    // кнопка копирования кладет ссылку в буфер
    await user.click(screen.getAllByRole('button', { name: ru.owner.copy })[0])
    expect(writeText).toHaveBeenCalledWith(url)

    // форма очищена
    expect(
      screen.getByRole('textbox', { name: ru.owner.nameLabel }),
    ).toHaveValue('')
  })

  it('сетевая ошибка при создании — сообщение об ошибке', async () => {
    stubFetch([
      { respond: () => json(200, []) },
      { method: 'POST', respond: () => new Response('boom', { status: 500 }) },
    ])
    const user = userEvent.setup()
    renderOwnerPage()
    await screen.findByText(ru.owner.empty)

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: ru.owner.create }))

    expect(await screen.findByText(ru.errors.network)).toBeInTheDocument()
  })
})
