import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.tsx'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { guestHref } from '../src/links.ts'
import type { Booking, EventType } from '../src/api.ts'

const ru = appCopy.ru

const ownerEmail = 'owner@example.com'
const eventType: EventType = {
  id: 7,
  ownerEmail,
  name: 'Знакомство',
  description: 'Первый созвон: знакомимся и обсуждаем идеи',
  duration: 30,
}
const eventTypesUrl = `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`
const slotsUrl = `${eventTypesUrl}/${eventType.id}/slots`
const bookingsUrl = `${eventTypesUrl}/${eventType.id}/bookings`

// "Сейчас" — 2024-06-15 10:00 по местному времени (TZ фиксирован на Europe/Moscow в vitest.config.ts).
const fixedNow = new Date(Date.UTC(2024, 5, 15, 7, 0, 0))
const todaySlot = new Date(2024, 5, 15, 11, 0).toISOString()
const todaySlot2 = new Date(2024, 5, 15, 11, 30).toISOString()

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubFetch(
  routes: { url: string; respond: () => Response }[],
) {
  const mock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const route = routes.find((candidate) => candidate.url === url)
    if (!route) {
      throw new Error(`нет стаба для ${url}`)
    }
    return route.respond()
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

function renderGuestPage() {
  window.history.pushState({}, '', guestHref(ownerEmail, eventType.id))
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
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(fixedNow)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function pickSlotAndFillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name = 'Гость', email = 'guest@example.com' } = {},
) {
  await screen.findByRole('button', { name: '11:00' })
  await user.click(screen.getByRole('button', { name: '11:00' }))
  if (name) await user.type(screen.getByLabelText(ru.guest.nameLabel), name)
  if (email) await user.type(screen.getByLabelText(ru.guest.emailLabel), email)
}

describe('гость: бронирование слота', () => {
  it('успешная бронь показывает подтверждение с деталями встречи', async () => {
    const booking: Booking = {
      id: 1,
      eventTypeId: eventType.id,
      ownerEmail,
      start: todaySlot,
      end: todaySlot2,
      guestName: 'Гость',
      guestEmail: 'guest@example.com',
      createdAt: fixedNow.toISOString(),
    }
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      { url: slotsUrl, respond: () => json(200, [todaySlot, todaySlot2]) },
      { url: bookingsUrl, respond: () => json(201, booking) },
    ])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGuestPage()

    await pickSlotAndFillForm(user)
    await user.click(screen.getByRole('button', { name: ru.guest.submit }))

    expect(await screen.findByText(ru.guest.confirmedTitle)).toBeInTheDocument()
    expect(screen.getByText(eventType.name)).toBeInTheDocument()
    expect(screen.getByText(`${ru.guest.guestLabel}: Гость`)).toBeInTheDocument()
    expect(screen.getByText(/2024-06-15 11:00/)).toBeInTheDocument()
  })

  it('пустое имя — подсказка под полем, запрос не отправляется', async () => {
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      { url: slotsUrl, respond: () => json(200, [todaySlot]) },
    ])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGuestPage()

    await pickSlotAndFillForm(user, { name: '', email: 'guest@example.com' })
    await user.click(screen.getByRole('button', { name: ru.guest.submit }))

    expect(await screen.findByText(ru.guest.nameRequired)).toBeInTheDocument()
  })

  it('некорректный email — подсказка под полем, запрос не отправляется', async () => {
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      { url: slotsUrl, respond: () => json(200, [todaySlot]) },
    ])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGuestPage()

    await pickSlotAndFillForm(user, { name: 'Гость', email: 'not-an-email' })
    await user.click(screen.getByRole('button', { name: ru.guest.submit }))

    expect(await screen.findByText(ru.guest.emailInvalid)).toBeInTheDocument()
  })

  it('409 при отправке — показывает объяснение и свежие слоты на той же странице', async () => {
    let slotsCall = 0
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      {
        url: slotsUrl,
        respond: () => {
          slotsCall += 1
          // после конфликта слот больше не предлагается
          return json(200, slotsCall === 1 ? [todaySlot, todaySlot2] : [todaySlot2]);
        },
      },
      {
        url: bookingsUrl,
        respond: () => json(409, { message: 'slot is already booked' }),
      },
    ])
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderGuestPage()

    await pickSlotAndFillForm(user)
    await user.click(screen.getByRole('button', { name: ru.guest.submit }))

    expect(await screen.findByText(ru.guest.slotTaken)).toBeInTheDocument()
    // та же страница (не подтверждение); слот, который заняли, пропал из свежего списка
    expect(screen.queryByText(ru.guest.confirmedTitle)).not.toBeInTheDocument()
    expect(
      await screen.findByRole('button', { name: '11:30' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '11:00' })).not.toBeInTheDocument()
  })
})
