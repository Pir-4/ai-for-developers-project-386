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
const eventType: EventType = {
  id: 7,
  ownerEmail,
  name: 'Знакомство',
  description: 'Первый созвон: знакомимся и обсуждаем идеи',
  duration: 30,
}
const eventTypesUrl = `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`
const slotsUrl = `${eventTypesUrl}/${eventType.id}/slots`

// "Сейчас" — 2024-06-15 10:00 по местному времени (TZ фиксирован в vitest.config.ts
// на Europe/Moscow, UTC+3, без летнего времени): середина месяца, без сюрпризов
// на границе месяца/года.
const fixedNow = new Date(Date.UTC(2024, 5, 15, 7, 0, 0))
const todaySlot1 = new Date(2024, 5, 15, 11, 0).toISOString()
const todaySlot2 = new Date(2024, 5, 15, 14, 30).toISOString()
const tomorrowSlot = new Date(2024, 5, 16, 9, 30).toISOString()

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Mantine's DatePicker day cells are labeled "D MMMM YYYY" (dayjs default 'en' locale).
function dayCellName(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

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
  window.history.pushState(
    {},
    '',
    guestHref(ownerEmail, eventType.id),
  )
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

describe('гость: календарь и свободные слоты', () => {
  it('показывает слоты текущего дня, отформатированные в местном времени, и часовой пояс', async () => {
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      {
        url: slotsUrl,
        respond: () => json(200, [todaySlot1, todaySlot2, tomorrowSlot]),
      },
    ])
    renderGuestPage()

    expect(
      await screen.findByRole('button', { name: '11:00' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '14:30' })).toBeInTheDocument()
    // слот следующего дня пока не показан
    expect(
      screen.queryByRole('button', { name: '09:30' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(`${ru.guest.timezoneLabel}: Europe/Moscow`),
    ).toBeInTheDocument()
  })

  it('выбор другого дня в календаре показывает слоты этого дня', async () => {
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      {
        url: slotsUrl,
        respond: () => json(200, [todaySlot1, tomorrowSlot]),
      },
    ])
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    })
    renderGuestPage()
    await screen.findByRole('button', { name: '11:00' })

    await user.click(
      screen.getByRole('button', { name: dayCellName(new Date(2024, 5, 16)) }),
    )

    expect(await screen.findByRole('button', { name: '09:30' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '11:00' })).not.toBeInTheDocument()
  })

  it('пустой день — подсказка об отсутствии свободного времени', async () => {
    stubFetch([
      { url: eventTypesUrl, respond: () => json(200, [eventType]) },
      { url: slotsUrl, respond: () => json(200, []) },
    ])
    renderGuestPage()

    expect(await screen.findByText(ru.guest.noSlotsForDay)).toBeInTheDocument()
  })

  it('неизвестный тип встречи — сообщение "не найдено"', async () => {
    stubFetch([{ url: eventTypesUrl, respond: () => json(200, []) }])
    renderGuestPage()

    expect(await screen.findByText(ru.guest.notFound)).toBeInTheDocument()
  })
})
