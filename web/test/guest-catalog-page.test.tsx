import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { GuestCatalogPage } from '../src/pages/GuestCatalogPage.tsx'
import { json, stubFetch, type FetchCall } from './fetch-stub.ts'

const ru = appCopy.ru.guestCatalog
const owner = { name: 'Анна Смирнова', email: 'anna@example.com' }

const eventTypes = [
  { id: 1, name: 'Знакомство', description: 'Первый созвон', durationMinutes: 30 },
  { id: 2, name: 'Консультация', description: 'Разбор задачи', durationMinutes: 30 },
]

// Профиль владельца — всегда; список типов — как задаст тест.
function stubApi(eventTypesResponse: () => Response): FetchCall[] {
  return stubFetch(({ url }) =>
    url.endsWith('/api/owner') ? json(200, owner) : eventTypesResponse(),
  )
}

function renderCatalog() {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={['/book']}>
          <Routes>
            <Route path="/book" element={<GuestCatalogPage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('каталог типов встреч для гостя', () => {
  it('показывает имя владельца и его типы с описанием и длительностью 30 минут', async () => {
    const calls = stubApi(() => json(200, eventTypes))
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Консультация' }))
      .closest('a') as HTMLElement
    expect(within(card).getByText('Разбор задачи')).toBeInTheDocument()
    expect(within(card).getByText('30 мин')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Знакомство' })).toBeInTheDocument()
    expect(await screen.findByText(`${ru.ownerLabel} ${owner.name}`)).toBeInTheDocument()
    expect(calls.map((call) => new URL(call.url).pathname).sort()).toEqual([
      '/api/event-types',
      '/api/owner',
    ])
  })

  it('карточка ведёт на запись именно на этот тип', async () => {
    stubApi(() => json(200, eventTypes))
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Консультация' }))
      .closest('a')
    expect(card).toHaveAttribute('href', '/book/2')
  })

  it('владелец без типов — понятное сообщение', async () => {
    stubApi(() => json(200, []))
    renderCatalog()
    expect(await screen.findByText(ru.empty)).toBeInTheDocument()
  })

  it('сервер недоступен — сообщение об ошибке', async () => {
    stubApi(() => json(500, { message: 'boom' }))
    renderCatalog()
    expect(await screen.findByText(appCopy.ru.errors.network)).toBeInTheDocument()
  })
})
