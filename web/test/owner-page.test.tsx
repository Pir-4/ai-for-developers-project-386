import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { OwnerPage } from '../src/pages/OwnerPage.tsx'

const ru = appCopy.ru.owner
const owner = 'owner@example.com'

// Тестовая зона — Europe/Moscow (+03:00, см. vitest.config.ts).
function todayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function localIso(hours: number, minutes = 0): string {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function stubApi(
  options: {
    availability?: unknown[]
    meetings?: unknown[]
    putStatus?: number
    blocking?: unknown[]
  } = {},
) {
  const calls: { url: string; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (init?.method === 'PUT') {
        if (options.putStatus === 409) {
          return json(409, {
            message: 'availability cannot be withdrawn from under a booking',
            meetings: options.blocking ?? [],
          })
        }
        const body = JSON.parse(String(init.body)) as { intervals: unknown[] }
        return json(200, { date: todayDate(), intervals: body.intervals })
      }
      if (url.includes('/meetings')) return json(200, options.meetings ?? [])
      return json(200, options.availability ?? [])
    }),
  )
  return calls
}

function renderOwner() {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[`/owner/${encodeURIComponent(owner)}`]}>
          <Routes>
            <Route path="/owner/:email" element={<OwnerPage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('кабинет владельца: календарь доступности', () => {
  it('день без часов подписан как закрытый', async () => {
    stubApi()
    renderOwner()
    expect(await screen.findByText(ru.dayClosed)).toBeInTheDocument()
  })

  it('сохраняет добавленный интервал как UTC-инстанты', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getByRole('button', { name: ru.save }))

    expect(await screen.findByText(ru.saved)).toBeInTheDocument()
    const put = calls.find((call) => call.init?.method === 'PUT')
    expect(put?.url).toContain(`/availability/${todayDate()}`)
    // Браузер сам переводит локальные 11:00–15:00 в UTC — сервер ничего не разворачивает.
    expect(JSON.parse(String(put?.init?.body))).toEqual({
      intervals: [{ start: localIso(11), end: localIso(15) }],
    })
  })

  it('подставляет уже сохранённые часы в редактор', async () => {
    stubApi({
      availability: [
        {
          date: todayDate(),
          intervals: [{ start: localIso(9), end: localIso(13) }],
        },
      ],
    })
    renderOwner()

    // Mantine Select рендерит и видимый combobox, и скрытый input для формы —
    // проверяем, что сохранённые часы показаны, не придираясь к тому, которым.
    expect(await screen.findAllByDisplayValue('09:00')).not.toHaveLength(0)
    expect(screen.getAllByDisplayValue('13:00')).not.toHaveLength(0)
  })

  it('пересекающиеся интервалы не уходят на сервер', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getByRole('button', { name: ru.save }))

    expect(screen.getByText(ru.intervalsOverlap)).toBeInTheDocument()
    expect(calls.some((call) => call.init?.method === 'PUT')).toBe(false)
  })

  it('интервал можно удалить', async () => {
    stubApi({
      availability: [
        {
          date: todayDate(),
          intervals: [{ start: localIso(9), end: localIso(13) }],
        },
      ],
    })
    const user = userEvent.setup()
    renderOwner()
    await screen.findAllByLabelText(ru.fromLabel)

    await user.click(screen.getByRole('button', { name: ru.removeInterval }))

    expect(screen.getByText(ru.dayClosed)).toBeInTheDocument()
  })

  it('409 показывает, какая встреча держит день', async () => {
    stubApi({
      putStatus: 409,
      blocking: [{ start: localIso(12), end: localIso(12, 45), guestName: 'Гость' }],
    })
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getByRole('button', { name: ru.save }))

    expect(await screen.findByText(ru.conflictTitle)).toBeInTheDocument()
    expect(screen.getByText(/Гость/)).toBeInTheDocument()
    expect(screen.queryByText(ru.saved)).not.toBeInTheDocument()
  })

  it('показывает одну ссылку на календарь, без типов встреч', async () => {
    stubApi()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    expect(
      screen.getByText(`http://localhost:3000/book/${encodeURIComponent(owner)}`),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ru.copy })).toBeInTheDocument()
  })

  it('перечисляет ближайшие встречи с длительностью и гостем', async () => {
    stubApi({
      meetings: [
        {
          id: 1,
          ownerEmail: owner,
          start: localIso(14),
          end: localIso(14, 45),
          durationMinutes: 45,
          guestName: 'Гость',
          guestEmail: 'guest@example.com',
        },
      ],
    })
    renderOwner()

    expect(
      await screen.findByText(/Гость <guest@example\.com>/),
    ).toBeInTheDocument()
    expect(screen.getByText('45 мин')).toBeInTheDocument()
  })

  it('пустой список встреч подписан', async () => {
    stubApi()
    renderOwner()
    expect(await screen.findByText(ru.meetingsEmpty)).toBeInTheDocument()
  })
})
