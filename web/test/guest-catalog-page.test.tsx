import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { GuestCatalogPage } from '../src/pages/GuestCatalogPage.tsx'
import { json, stubFetch } from './fetch-stub.ts'

const ru = appCopy.ru.guestCatalog
const owner = 'owner@example.com'

const eventTypes = [
  { id: 1, ownerEmail: owner, name: 'Знакомство', description: 'Первый созвон', durationMinutes: 15 },
  { id: 2, ownerEmail: owner, name: 'Консультация', description: 'Разбор задачи', durationMinutes: 45 },
]

function renderCatalog() {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[`/book/${encodeURIComponent(owner)}`]}>
          <Routes>
            <Route path="/book/:email" element={<GuestCatalogPage />} />
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
  it('показывает типы владельца с описанием и длительностью', async () => {
    const calls = stubFetch(() => json(200, eventTypes))
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Консультация' }))
      .closest('a') as HTMLElement
    expect(within(card).getByText('Разбор задачи')).toBeInTheDocument()
    expect(within(card).getByText('45 мин')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Знакомство' })).toBeInTheDocument()
    expect(calls[0]?.url).toContain(`/api/owners/${encodeURIComponent(owner)}/event-types`)
  })

  it('карточка ведёт на запись именно на этот тип', async () => {
    stubFetch(() => json(200, eventTypes))
    renderCatalog()

    const card = (await screen.findByRole('heading', { level: 3, name: 'Консультация' }))
      .closest('a')
    expect(card).toHaveAttribute('href', `/book/${encodeURIComponent(owner)}/2`)
  })

  it('владелец без типов — понятное сообщение', async () => {
    stubFetch(() => json(200, []))
    renderCatalog()
    expect(await screen.findByText(ru.empty)).toBeInTheDocument()
  })

  it('сервер недоступен — сообщение об ошибке', async () => {
    stubFetch(() => json(500, { message: 'boom' }))
    renderCatalog()
    expect(await screen.findByText(appCopy.ru.errors.network)).toBeInTheDocument()
  })
})
