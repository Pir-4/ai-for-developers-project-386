import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { GuestPage } from '../src/pages/GuestPage.tsx'
import { json, stubFetch } from './fetch-stub.ts'

const ru = appCopy.ru.guest
const owner = 'owner@example.com'

// Тестовая зона — Europe/Moscow (+03:00, см. vitest.config.ts): локальные 11:00
// это 08:00Z. Слоты строим от сегодняшней локальной даты, чтобы не зависеть от
// дня запуска.
function localIso(hours: number, minutes = 0): string {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

type Slot = { start: string; end: string; status: 'free' | 'busy' }

const consult = {
  id: 5,
  ownerEmail: owner,
  name: 'Консультация',
  description: 'Разбор вашей задачи',
  durationMinutes: 30,
}

const ladder: Slot[] = [
  { start: localIso(11, 0), end: localIso(11, 30), status: 'free' },
  { start: localIso(11, 30), end: localIso(12, 0), status: 'busy' },
  { start: localIso(12, 0), end: localIso(12, 30), status: 'free' },
]

function stubApi(options: { bookingStatus?: number; slots?: Slot[]; typeStatus?: number } = {}) {
  return stubFetch(({ url, method, body }) => {
    if (method === 'POST') {
      const status = options.bookingStatus ?? 201
      if (status === 409) {
        return json(409, { message: 'slot is already booked' })
      }
      const { start, guestName } = body as { start: string; guestName: string }
      return json(201, {
        id: 1,
        eventTypeId: consult.id,
        ownerEmail: owner,
        start,
        end: start,
        durationMinutes: consult.durationMinutes,
        guestName,
        guestEmail: 'guest@example.com',
        createdAt: start,
      })
    }
    if (url.endsWith('/slots')) return json(200, options.slots ?? ladder)
    if (options.typeStatus === 404) return json(404, { message: 'event type not found' })
    return json(200, consult)
  })
}

function renderGuest(eventTypeId = consult.id) {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[`/book/${encodeURIComponent(owner)}/${eventTypeId}`]}>
          <Routes>
            <Route path="/book/:email/:eventTypeId" element={<GuestPage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('гостевая страница: запись на выбранный тип встречи', () => {
  it('показывает лестницу слотов со статусами, занятые — видимы и некликабельны', async () => {
    stubApi()
    renderGuest()

    const free = await screen.findByRole('button', { name: /11:00 - 11:30/ })
    expect(within(free).getByText(ru.statusFree)).toBeInTheDocument()
    expect(free).toBeEnabled()

    const busy = screen.getByRole('button', { name: /11:30 - 12:00/ })
    expect(within(busy).getByText(ru.statusBusy)).toBeInTheDocument()
    expect(busy).toBeDisabled()
  })

  it('занятая ячейка не раскрывает, кто её занял', async () => {
    stubApi()
    const { container } = renderGuest()
    await screen.findByRole('button', { name: /11:00 - 11:30/ })

    expect(container.textContent).not.toMatch(/@/u.source + 'guest')
    expect(screen.queryByText(/guest@/)).not.toBeInTheDocument()
  })

  it('показывает выбранный тип и запрашивает лестницу именно этого типа', async () => {
    const calls = stubApi()
    renderGuest()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Консультация' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Разбор вашей задачи')).toBeInTheDocument()
    expect(screen.getByText(`${ru.durationLabel}: 30 мин`)).toBeInTheDocument()
    await screen.findByRole('button', { name: /11:00 - 11:30/ })
    expect(
      calls.some((call) =>
        call.url.endsWith(`/api/owners/${encodeURIComponent(owner)}/event-types/5/slots`),
      ),
    ).toBe(true)
    // Гость больше не выбирает длительность сам.
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })

  it('ведёт обратно к каталогу типов', async () => {
    stubApi()
    renderGuest()
    const back = await screen.findByRole('link', { name: ru.backToCatalog })
    expect(back).toHaveAttribute('href', `/book/${encodeURIComponent(owner)}`)
  })

  it('несуществующий тип — понятное сообщение', async () => {
    stubApi({ typeStatus: 404 })
    renderGuest(999)
    expect(await screen.findByText(ru.eventTypeNotFound)).toBeInTheDocument()
  })

  it('календарь показывает счётчик свободных на дне', async () => {
    stubApi()
    renderGuest()
    await screen.findByRole('button', { name: /11:00 - 11:30/ })

    // Из трёх ячеек свободны две.
    expect(screen.getByText(`2 ${ru.freeCountSuffix}`)).toBeInTheDocument()
  })

  it('выбор слота открывает форму, успешная бронь — подтверждение', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderGuest()

    await user.click(await screen.findByRole('button', { name: /11:00 - 11:30/ }))
    await user.type(screen.getByLabelText(ru.nameLabel), 'Гость')
    await user.type(screen.getByLabelText(ru.emailLabel), 'guest@example.com')
    await user.click(screen.getByRole('button', { name: ru.submit }))

    expect(
      await screen.findByRole('heading', { level: 1, name: ru.confirmedTitle }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Гость/)).toBeInTheDocument()
    expect(screen.getByText('Консультация')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.url).toContain('/event-types/5/bookings')
    expect(post?.body).toEqual({
      guestName: 'Гость',
      guestEmail: 'guest@example.com',
      start: localIso(11, 0),
    })
  })

  it('пустое имя и кривая почта — ошибки полей, запрос не уходит', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderGuest()

    await user.click(await screen.findByRole('button', { name: /11:00 - 11:30/ }))
    await user.type(screen.getByLabelText(ru.emailLabel), 'не почта')
    await user.click(screen.getByRole('button', { name: ru.submit }))

    expect(screen.getByText(ru.nameRequired)).toBeInTheDocument()
    expect(screen.getByText(ru.emailInvalid)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('нечисловой id в ссылке — «такого типа нет», без запросов к API', async () => {
    const calls = stubApi()
    render(
      <MantineProvider>
        <LocaleProvider>
          <MemoryRouter initialEntries={[`/book/${encodeURIComponent(owner)}/abc`]}>
            <Routes>
              <Route path="/book/:email/:eventTypeId" element={<GuestPage />} />
            </Routes>
          </MemoryRouter>
        </LocaleProvider>
      </MantineProvider>,
    )
    expect(await screen.findByText(ru.eventTypeNotFound)).toBeInTheDocument()
    expect(calls).toEqual([])
  })

  it('409 и неудачное обновление лестницы — прежняя лестница остаётся на экране', async () => {
    let slotRequests = 0
    stubFetch(({ url, method }) => {
      if (method === 'POST') return json(409, { message: 'slot is already booked' })
      if (url.endsWith('/slots')) {
        slotRequests += 1
        return slotRequests === 1 ? json(200, ladder) : json(500, { message: 'boom' })
      }
      return json(200, consult)
    })
    const user = userEvent.setup()
    renderGuest()

    await user.click(await screen.findByRole('button', { name: /11:00 - 11:30/ }))
    await user.type(screen.getByLabelText(ru.nameLabel), 'Гость')
    await user.type(screen.getByLabelText(ru.emailLabel), 'guest@example.com')
    await user.click(screen.getByRole('button', { name: ru.submit }))

    expect(await screen.findByText(ru.slotTaken)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /12:00 - 12:30/ })).toBeInTheDocument()
    expect(screen.queryByText(appCopy.ru.errors.network)).not.toBeInTheDocument()
  })

  it('409 — сообщение и обновлённая лестница вместо потерянной брони', async () => {
    stubApi({ bookingStatus: 409 })
    const user = userEvent.setup()
    renderGuest()

    await user.click(await screen.findByRole('button', { name: /11:00 - 11:30/ }))
    await user.type(screen.getByLabelText(ru.nameLabel), 'Гость')
    await user.type(screen.getByLabelText(ru.emailLabel), 'guest@example.com')
    await user.click(screen.getByRole('button', { name: ru.submit }))

    expect(await screen.findByText(ru.slotTaken)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /11:00 - 11:30/ })).toBeInTheDocument()
  })

  it('владелец без доступности — понятное сообщение, а не пустой экран', async () => {
    stubApi({ slots: [] })
    renderGuest()

    expect(await screen.findByText(ru.noAvailability)).toBeInTheDocument()
  })
})
