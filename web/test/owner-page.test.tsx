import { MantineProvider } from '@mantine/core'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { appCopy } from '../src/content/app.ts'
import { LocaleProvider } from '../src/i18n.tsx'
import { OwnerPage } from '../src/pages/OwnerPage.tsx'
import { json, stubFetch } from './fetch-stub.ts'

const ru = appCopy.ru.owner
const owner = { name: 'Анна Смирнова', email: 'anna@example.com' }

// Тестовая зона — Europe/Moscow (+03:00, см. vitest.config.ts).
function todayDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Mantine's day buttons are labelled "D MMMM YYYY" (no DatesProvider locale
// override in this app, so English) — matches the calendar's own aria-label.
function dayAccessibleName(date: Date): string {
  return dayjs(date).format('D MMMM YYYY')
}

// A day in the same displayed month as today but guaranteed not to be it.
function anotherDayThisMonth(): Date {
  const now = new Date()
  const day = now.getDate() === 1 ? 2 : 1
  return new Date(now.getFullYear(), now.getMonth(), day)
}

function localIso(hours: number, minutes = 0): string {
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date.toISOString()
}

function stubApi(
  options: {
    availability?: unknown[]
    meetings?: unknown[]
    eventTypes?: unknown[]
    putStatus?: number
    blocking?: unknown[]
    createTypeStatus?: number
  } = {},
) {
  return stubFetch(({ url, method, body }) => {
    if (url.endsWith('/api/owner')) return json(200, owner)
    if (method === 'PUT') {
      if (options.putStatus === 409) {
        return json(409, {
          message: 'availability cannot be withdrawn from under a booking',
          meetings: options.blocking ?? [],
        })
      }
      const { intervals } = body as { intervals: unknown[] }
      return json(200, { date: todayDate(), intervals })
    }
    if (url.includes('/event-types')) {
      if (method === 'POST') {
        if (options.createTypeStatus === 422) {
          return json(422, {
            message: 'invalid',
            errors: [{ path: 'name', message: 'must NOT have more than 100 characters' }],
          })
        }
        return json(201, { id: 7, ...(body as object) })
      }
      return json(200, options.eventTypes ?? [])
    }
    if (url.includes('/meetings')) return json(200, options.meetings ?? [])
    return json(200, options.availability ?? [])
  })
}

function renderOwner() {
  return render(
    <MantineProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={['/owner']}>
          <Routes>
            <Route path="/owner" element={<OwnerPage />} />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>
    </MantineProvider>,
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('кабинет владельца: единственный владелец', () => {
  it('открывается без входа и показывает заранее заданного владельца', async () => {
    stubApi()
    renderOwner()
    expect(await screen.findByText(`${owner.name} · ${owner.email}`)).toBeInTheDocument()
  })
})

describe('кабинет владельца: календарь доступности', () => {
  it('календарь открывает ровно 14 дней, включая сегодня', async () => {
    // Только Date: 5 октября 09:00 по Москве — окно 5…18 октября.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T06:00:00.000Z') })
    stubApi()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    const day = (date: number) =>
      screen.getByRole('button', { name: dayAccessibleName(new Date(2026, 9, date)) })
    expect(day(5)).toBeEnabled()
    expect(day(18)).toBeEnabled()
    expect(day(19)).toBeDisabled()
    expect(day(4)).toBeDisabled()
  })

  it('часы выбираются только по сетке 30 минут', async () => {
    stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getAllByLabelText(ru.fromLabel)[0]!)

    const options = (await screen.findAllByRole('option', { hidden: true }))
      .map((option) => option.textContent)
      .filter((text) => /^\d\d:\d\d$/.test(text ?? ''))
    // Оба Select («Начало» и «Конец») держат один и тот же список: 00:00 … 23:30.
    expect(new Set(options).size).toBe(48)
    expect(options).toContain('11:30')
    expect(options).not.toContain('11:15')
    expect(options).not.toContain('11:45')
  })

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
    const put = calls.find((call) => call.method === 'PUT')
    expect(put?.url).toContain(`/availability/${todayDate()}`)
    // Браузер сам переводит локальные 11:00–15:00 в UTC — сервер ничего не разворачивает.
    expect(put?.body).toEqual({
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
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
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
      blocking: [{ start: localIso(12), end: localIso(12, 30), guestName: 'Гость' }],
    })
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    await user.click(screen.getByRole('button', { name: ru.addInterval }))
    await user.click(screen.getByRole('button', { name: ru.save }))

    expect(await screen.findByText(ru.conflictTitle)).toBeInTheDocument()
    expect(screen.getByText(/— Гость$/)).toBeInTheDocument()
    expect(screen.queryByText(ru.saved)).not.toBeInTheDocument()
  })

  it('показывает ссылку на каталог типов встреч для гостя', async () => {
    stubApi()
    renderOwner()
    await screen.findByText(ru.dayClosed)

    expect(
      screen.getByText('http://localhost:3000/book'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: ru.copy })).toBeInTheDocument()
  })

  it('перечисляет ближайшие встречи с длительностью и гостем', async () => {
    stubApi({
      meetings: [
        {
          id: 1,
          eventTypeId: 3,
          eventTypeName: 'Консультация',
          start: localIso(14),
          end: localIso(14, 30),
          durationMinutes: 30,
          guestName: 'Гость',
          guestEmail: 'guest@example.com',
        },
      ],
    })
    renderOwner()

    const guestLine = await screen.findByText(/Гость <guest@example\.com>/)
    const row = within(guestLine.closest('article') as HTMLElement)
    expect(row.getByText('30 мин')).toBeInTheDocument()
    expect(row.getByText('Консультация')).toBeInTheDocument()
  })

  it('пустой список встреч подписан', async () => {
    stubApi()
    renderOwner()
    expect(await screen.findByText(ru.meetingsEmpty)).toBeInTheDocument()
  })

  it('отмечает в календаре день со встречей, но не день без неё', async () => {
    stubApi({
      meetings: [
        {
          id: 1,
          eventTypeId: 3,
          eventTypeName: 'Консультация',
          start: localIso(14),
          end: localIso(14, 30),
          durationMinutes: 30,
          guestName: 'Гость',
          guestEmail: 'guest@example.com',
        },
      ],
    })
    renderOwner()
    await screen.findByText(/Гость <guest@example\.com>/)

    const meetingDay = screen.getByRole('button', { name: dayAccessibleName(new Date()) })
    expect(meetingDay).toHaveAttribute('data-has-meeting', 'true')

    const emptyDay = screen.getByRole('button', {
      name: dayAccessibleName(anotherDayThisMonth()),
    })
    expect(emptyDay).not.toHaveAttribute('data-has-meeting')
  })
})

describe('кабинет владельца: типы встреч', () => {
  // Подпись Select ссылается и на поле, и на его выпадающий список — берём поле.
  const durationInput = () =>
    screen
      .getAllByLabelText(ru.typeDurationLabel)
      .find((element) => element.tagName === 'INPUT') as HTMLInputElement

  const consult = {
    id: 3,
    name: 'Консультация',
    description: 'Разбор вашей задачи',
    durationMinutes: 30,
  }

  it('без типов — подсказка создать первый', async () => {
    stubApi()
    renderOwner()
    expect(await screen.findByText(ru.eventTypesEmpty)).toBeInTheDocument()
  })

  it('перечисляет типы с длительностью и ссылкой на запись именно на этот тип', async () => {
    stubApi({ eventTypes: [consult] })
    renderOwner()

    expect(await screen.findByText('Консультация')).toBeInTheDocument()
    expect(screen.getByText('Разбор вашей задачи')).toBeInTheDocument()
    expect(
      screen.getByText('http://localhost:3000/book/3'),
    ).toBeInTheDocument()
  })

  it('длительность выбирается из 30, 60, 90 и 120 минут, по умолчанию 30', async () => {
    stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.eventTypesEmpty)

    const duration = durationInput()
    expect(duration).toHaveValue('30 мин')
    await user.click(duration)
    const options = (await screen.findAllByRole('option', { hidden: true }))
      .map((option) => option.textContent)
      .filter((text) => text?.endsWith('мин'))
    expect(options).toEqual(['30 мин', '60 мин', '90 мин', '120 мин'])
  })

  it('создаёт тип с выбранной длительностью', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.eventTypesEmpty)

    await user.type(screen.getByLabelText(ru.typeNameLabel), 'Консультация')
    await user.type(screen.getByLabelText(ru.typeDescriptionLabel), 'Разбор задачи')
    await user.click(durationInput())
    await user.click(await screen.findByRole('option', { name: '60 мин', hidden: true }))
    await user.click(screen.getByRole('button', { name: ru.createEventType }))

    const card = (await screen.findByText('Консультация')).closest('article') as HTMLElement
    expect(within(card).getByText('60 мин')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(post?.body).toEqual({
      name: 'Консультация',
      description: 'Разбор задачи',
      durationMinutes: 60,
    })
    // Форма сбрасывается к длительности по умолчанию.
    expect(durationInput()).toHaveValue('30 мин')
  })

  it('создаёт тип: название и описание уходят на сервер', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.eventTypesEmpty)

    await user.type(screen.getByLabelText(ru.typeNameLabel), 'Знакомство')
    await user.type(screen.getByLabelText(ru.typeDescriptionLabel), 'Первый созвон')
    await user.click(screen.getByRole('button', { name: ru.createEventType }))

    expect(await screen.findByText('Знакомство')).toBeInTheDocument()
    const post = calls.find((call) => call.method === 'POST')
    expect(new URL(post!.url).pathname).toBe('/api/event-types')
    expect(post?.body).toEqual({
      name: 'Знакомство',
      description: 'Первый созвон',
      durationMinutes: 30,
    })
    expect(screen.queryByText(ru.eventTypesEmpty)).not.toBeInTheDocument()
  })

  it('пустые поля — ошибки у полей, запрос не уходит', async () => {
    const calls = stubApi()
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.eventTypesEmpty)

    await user.click(screen.getByRole('button', { name: ru.createEventType }))

    expect(screen.getByText(ru.typeNameRequired)).toBeInTheDocument()
    expect(screen.getByText(ru.typeDescriptionRequired)).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'POST')).toBe(false)
  })

  it('422 от сервера показывается у поля', async () => {
    stubApi({ createTypeStatus: 422 })
    const user = userEvent.setup()
    renderOwner()
    await screen.findByText(ru.eventTypesEmpty)

    await user.type(screen.getByLabelText(ru.typeNameLabel), 'Знакомство')
    await user.type(screen.getByLabelText(ru.typeDescriptionLabel), 'Первый созвон')
    await user.click(screen.getByRole('button', { name: ru.createEventType }))

    expect(
      await screen.findByText('must NOT have more than 100 characters'),
    ).toBeInTheDocument()
  })
})
