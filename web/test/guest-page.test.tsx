import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { GuestPage } from '../src/pages/GuestPage.tsx'

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

const ladder = (duration: number): Slot[] =>
  duration === 30
    ? [
        { start: localIso(11, 0), end: localIso(11, 30), status: 'free' },
        { start: localIso(11, 30), end: localIso(12, 0), status: 'busy' },
        { start: localIso(12, 0), end: localIso(12, 30), status: 'free' },
      ]
    : [{ start: localIso(11, 0), end: localIso(11, 45), status: 'free' }]

function stubApi(options: { bookingStatus?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === 'POST') {
        const status = options.bookingStatus ?? 201
        if (status === 409) {
          return json(409, { message: 'slot is already booked' })
        }
        const body = JSON.parse(String(init.body)) as {
          start: string
          durationMinutes: number
          guestName: string
        }
        return json(201, {
          id: 1,
          ownerEmail: owner,
          start: body.start,
          end: body.start,
          durationMinutes: body.durationMinutes,
          guestName: body.guestName,
          guestEmail: 'guest@example.com',
          createdAt: body.start,
        })
      }
      const duration = Number(new URL(url, 'http://localhost').searchParams.get('duration'))
      return json(200, ladder(duration))
    }),
  )
  return calls
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderGuest() {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[`/book/${encodeURIComponent(owner)}`]}>
          <Routes>
            <Route path="/book/:email" element={<GuestPage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('гостевая страница: календарь владельца', () => {
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

  it('смена длительности перезапрашивает лестницу', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderGuest()
    await screen.findByRole('button', { name: /11:00 - 11:30/ })

    await user.click(screen.getByRole('radio', { name: '45 мин' }))

    expect(await screen.findByRole('button', { name: /11:00 - 11:45/ })).toBeInTheDocument()
    expect(calls.some((call) => call.url.includes('duration=45'))).toBe(true)
  })

  it('календарь показывает счётчик свободных на дне', async () => {
    stubApi()
    renderGuest()
    await screen.findByRole('button', { name: /11:00 - 11:30/ })

    // Из трёх ячеек свободны две.
    expect(screen.getByText(`2 ${ru.freeCountSuffix}`)).toBeInTheDocument()
  })

  it('выбор слота открывает форму, успешная бронь — подтверждение', async () => {
    stubApi()
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
    expect(calls.some((call) => call.init?.method === 'POST')).toBe(false)
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
    vi.stubGlobal('fetch', vi.fn(async () => json(200, [])))
    renderGuest()

    expect(await screen.findByText(ru.noAvailability)).toBeInTheDocument()
  })
})
