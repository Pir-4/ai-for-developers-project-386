import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { Box, Button, Card, Container, Stack, Text, TextInput, Title } from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import {
  ApiConflictError,
  ApiValidationError,
  createBooking,
  listEventTypes,
  listSlots,
  type Booking,
  type EventType,
} from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { formatLocalDateTime, formatLocalTime, localTimezone, toDateString } from '../localTime.ts'

// Pragmatic "looks like an email" check — same rule as the login page.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GUEST_NAME_MAX = 100

// Button grid: CSS grid auto-fit, no breakpoint JS (same spirit as the card
// rows in docs/ui-style.md, sized for short time labels instead of cards).
const slotGridStyle = {
  display: 'grid',
  gap: 'var(--mantine-spacing-xs)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
} as const

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

type BookingFieldErrors = Partial<Record<'name' | 'email' | 'form', string>>

const BOOKING_WINDOW_DAYS = 14

// Guest entry point (/book/:email/:id): the chosen event type, a calendar
// bounded to the 14-day booking window, and that day's free slots. Booking
// the chosen slot is a later step.
export function GuestPage() {
  const { email = '', id = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const t = useAppText().guest
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [state, setState] = useState<'loading' | 'ready' | 'notFound' | 'error'>(
    'loading',
  )
  const [eventType, setEventType] = useState<EventType | null>(null)

  const [slotsState, setSlotsState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [slots, setSlots] = useState<string[]>([])

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [bookingErrors, setBookingErrors] = useState<BookingFieldErrors>({})
  const [booking, setBooking] = useState(false)
  const [slotTaken, setSlotTaken] = useState(false)
  const [confirmed, setConfirmed] = useState<Booking | null>(null)

  const today = useMemo(() => startOfToday(), [])
  // Padded a day on each side: the server's window is anchored to UTC
  // midnight ("start < today 00:00 UTC + 14 days"), so a guest's local
  // calendar day can shift by up to a day from "today"/"+14 days" depending
  // on their UTC offset. The padding keeps the picker from hiding a day that
  // still has real slots — a day outside the actual window just renders empty.
  const minDate = useMemo(() => addDays(today, -1), [today])
  const maxDate = useMemo(() => addDays(today, BOOKING_WINDOW_DAYS), [today])
  const [selectedDate, setSelectedDate] = useState(() => toDateString(today))
  const [selectedStart, setSelectedStart] = useState<string | null>(null)

  const timezone = useMemo(() => localTimezone(), [])

  useEffect(() => {
    let cancelled = false
    listEventTypes(ownerEmail)
      .then((items) => {
        if (cancelled) return
        const found = items.find((item) => item.id === Number(id))
        setEventType(found ?? null)
        setState(found ? 'ready' : 'notFound')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail, id])

  useEffect(() => {
    if (state !== 'ready') return
    let cancelled = false
    setSlotsState('loading')
    listSlots(ownerEmail, Number(id))
      .then((loaded) => {
        if (cancelled) return
        setSlots(loaded)
        setSlotsState('ready')
      })
      .catch(() => {
        if (!cancelled) setSlotsState('error')
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail, id, state])

  const slotsForSelectedDay = slots.filter(
    (start) => toDateString(new Date(start)) === selectedDate,
  )

  function selectSlot(start: string) {
    setSelectedStart(start)
    setSlotTaken(false)
    setBookingErrors({})
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStart) return

    const name = guestName.trim()
    const email = guestEmail.trim()
    const errors: BookingFieldErrors = {}
    if (name.length < 1) errors.name = t.nameRequired
    else if (name.length > GUEST_NAME_MAX) errors.name = t.nameTooLong
    if (!EMAIL_RE.test(email)) errors.email = t.emailInvalid
    setBookingErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBooking(true)
    try {
      const result = await createBooking(ownerEmail, Number(id), {
        guestName: name,
        guestEmail: email,
        start: selectedStart,
      })
      setConfirmed(result)
    } catch (err) {
      if (err instanceof ApiConflictError) {
        setSlotTaken(true)
        setSelectedStart(null)
        setSlotsState('loading')
        try {
          setSlots(await listSlots(ownerEmail, Number(id)))
          setSlotsState('ready')
        } catch {
          setSlotsState('error')
        }
      } else if (err instanceof ApiValidationError) {
        const serverErrors: BookingFieldErrors = {}
        for (const issue of err.errors) {
          if (issue.path === 'guestName') serverErrors.name ??= issue.message
          else if (issue.path === 'guestEmail') serverErrors.email ??= issue.message
          else serverErrors.form ??= issue.message
        }
        setBookingErrors(serverErrors)
      } else {
        setBookingErrors({ form: errorsText.network })
      }
    } finally {
      setBooking(false)
    }
  }

  if (confirmed && eventType) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="lg" maw={480} mx="auto" w="100%">
          <Title order={1}>{t.confirmedTitle}</Title>
          <Card component="article" withBorder p="lg">
            <Stack gap="xs">
              <Title order={3}>{eventType.name}</Title>
              <Text size="sm">
                {`${t.whenLabel}: ${formatLocalDateTime(confirmed.start)} (${timezone})`}
              </Text>
              <Text size="sm">{`${t.guestLabel}: ${confirmed.guestName}`}</Text>
            </Stack>
          </Card>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg" maw={480} mx="auto" w="100%">
        <Title order={1}>{t.title}</Title>
        {state === 'loading' && null}
        {state === 'notFound' && (
          <Text c="dimmed" size="sm">
            {t.notFound}
          </Text>
        )}
        {state === 'error' && (
          <Text c="dimmed" size="sm">
            {errorsText.network}
          </Text>
        )}
        {state === 'ready' && eventType && (
          <Stack gap="lg">
            <Card component="article" withBorder p="lg">
              <Stack gap="xs">
                <Title order={3}>{eventType.name}</Title>
                <Text c="dimmed" size="sm">
                  {eventType.description}
                </Text>
                <Text c="dimmed" size="sm">
                  {eventType.duration} {shared.minutesSuffix}
                </Text>
              </Stack>
            </Card>

            <Stack gap="xs">
              <Title order={3}>{t.dayLabel}</Title>
              <DatePicker
                value={selectedDate}
                onChange={(value) => {
                  if (!value) return
                  setSelectedDate(value)
                  setSelectedStart(null)
                }}
                minDate={minDate}
                maxDate={maxDate}
              />
            </Stack>

            <Stack gap="xs">
              <Title order={3}>{t.timeLabel}</Title>
              <Text c="dimmed" size="xs">
                {`${t.timezoneLabel}: ${timezone}`}
              </Text>
              {slotTaken && (
                <Text c="red" size="sm">
                  {t.slotTaken}
                </Text>
              )}
              {slotsState === 'loading' && null}
              {slotsState === 'error' && (
                <Text c="dimmed" size="sm">
                  {errorsText.network}
                </Text>
              )}
              {slotsState === 'ready' && slotsForSelectedDay.length === 0 && (
                <Text c="dimmed" size="sm">
                  {t.noSlotsForDay}
                </Text>
              )}
              {slotsState === 'ready' && slotsForSelectedDay.length > 0 && (
                <Box style={slotGridStyle}>
                  {slotsForSelectedDay.map((start) => (
                    <Button
                      key={start}
                      variant={selectedStart === start ? 'filled' : 'default'}
                      onClick={() => selectSlot(start)}
                      aria-pressed={selectedStart === start}
                    >
                      {formatLocalTime(start)}
                    </Button>
                  ))}
                </Box>
              )}
            </Stack>

            {selectedStart && (
              <form onSubmit={submitBooking} noValidate>
                <Stack gap="md">
                  <TextInput
                    label={t.nameLabel}
                    value={guestName}
                    error={bookingErrors.name}
                    maxLength={GUEST_NAME_MAX}
                    onChange={(event) => setGuestName(event.currentTarget.value)}
                  />
                  <TextInput
                    label={t.emailLabel}
                    type="email"
                    value={guestEmail}
                    error={bookingErrors.email}
                    onChange={(event) => setGuestEmail(event.currentTarget.value)}
                  />
                  <Button type="submit" loading={booking}>
                    {t.submit}
                  </Button>
                  {bookingErrors.form && (
                    <Text c="red" size="sm">
                      {bookingErrors.form}
                    </Text>
                  )}
                </Stack>
              </form>
            )}
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
