import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import {
  Anchor,
  Box,
  Button,
  Card,
  Container,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import {
  ApiConflictError,
  ApiNotFoundError,
  ApiValidationError,
  createBooking,
  getEventType,
  listSlots,
  type Booking,
  type EventType,
  type Slot,
} from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { guestHref } from '../links.ts'
import {
  formatLocalDateTime,
  formatLocalTime,
  localDateOf,
  localTimezone,
  toDateString,
} from '../localTime.ts'

// Pragmatic "looks like an email" check — same rule as the login page.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GUEST_NAME_MAX = 100
const BOOKING_WINDOW_DAYS = 14

type BookingFieldErrors = Partial<Record<'name' | 'email' | 'form', string>>

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

/**
 * One event type's booking page (/book/:email/:eventTypeId): the guest has
 * already picked the type in the catalog, now picks a date and a free slot of
 * the type's length, then leaves a name and an email.
 *
 * The slots API answers flat; the binning into calendar days happens here, in
 * the guest's own timezone, so a cell at the edge of a day lands on the date
 * the guest would call it (see issue #39).
 */
export function GuestPage() {
  const { email = '', eventTypeId: eventTypeParam = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const eventTypeId = Number(eventTypeParam)
  // A mangled link (/book/:email/abc) names no event type: don't ask the API,
  // which would only answer 422 for the malformed path.
  const validEventTypeId = Number.isInteger(eventTypeId) && eventTypeId > 0
  const t = useAppText().guest
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [eventType, setEventType] = useState<EventType | null>(null)
  const [eventTypeState, setEventTypeState] = useState<
    'loading' | 'ready' | 'notFound' | 'error'
  >('loading')
  const [slotsState, setSlotsState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [slots, setSlots] = useState<Slot[]>([])

  const today = useMemo(() => startOfToday(), [])
  const [selectedDate, setSelectedDate] = useState(() => toDateString(today))
  const [selectedStart, setSelectedStart] = useState<string | null>(null)

  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [bookingErrors, setBookingErrors] = useState<BookingFieldErrors>({})
  const [booking, setBooking] = useState(false)
  const [slotTaken, setSlotTaken] = useState(false)
  const [confirmed, setConfirmed] = useState<Booking | null>(null)

  const timezone = useMemo(() => localTimezone(), [])

  useEffect(() => {
    let cancelled = false
    setEventType(null)
    if (!validEventTypeId) {
      setEventTypeState('notFound')
      return
    }
    setEventTypeState('loading')
    getEventType(ownerEmail, eventTypeId)
      .then((loaded) => {
        if (cancelled) return
        setEventType(loaded)
        setEventTypeState('ready')
      })
      .catch((err) => {
        if (!cancelled) setEventTypeState(err instanceof ApiNotFoundError ? 'notFound' : 'error')
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail, eventTypeId, validEventTypeId])

  useEffect(() => {
    let cancelled = false
    setSlots([])
    setSelectedStart(null)
    if (!validEventTypeId) return
    setSlotsState('loading')
    listSlots(ownerEmail, eventTypeId)
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
  }, [ownerEmail, eventTypeId, validEventTypeId])

  // The flat ladder, binned into the guest's own calendar days.
  const byDate = useMemo(() => {
    const map = new Map<string, Slot[]>()
    for (const slot of slots) {
      const date = localDateOf(slot.start)
      map.set(date, [...(map.get(date) ?? []), slot])
    }
    return map
  }, [slots])

  const freeCount = (date: string) =>
    (byDate.get(date) ?? []).filter((slot) => slot.status === 'free').length

  const slotsForSelectedDay = byDate.get(selectedDate) ?? []

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedStart) return

    const name = guestName.trim()
    const mail = guestEmail.trim()
    const errors: BookingFieldErrors = {}
    if (name.length < 1) errors.name = t.nameRequired
    else if (name.length > GUEST_NAME_MAX) errors.name = t.nameTooLong
    if (!EMAIL_RE.test(mail)) errors.email = t.emailInvalid
    setBookingErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBooking(true)
    try {
      setConfirmed(
        await createBooking(ownerEmail, eventTypeId, {
          guestName: name,
          guestEmail: mail,
          start: selectedStart,
        }),
      )
    } catch (err) {
      if (err instanceof ApiConflictError) {
        setSlotTaken(true)
        setSelectedStart(null)
        // Refresh the ladder so the taken cell shows as busy. If the refresh
        // fails, keep the ladder already on screen rather than hiding it.
        try {
          setSlots(await listSlots(ownerEmail, eventTypeId))
          setSlotsState('ready')
        } catch {
          // keep the current slots and state
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

  const backToCatalog = (
    <Anchor component={Link} to={guestHref(ownerEmail)} size="sm">
      {t.backToCatalog}
    </Anchor>
  )

  if (eventTypeState === 'notFound' || eventTypeState === 'error') {
    return (
      <Container size="sm" py="xl">
        <Stack gap="md">
          <Title order={1}>{t.title}</Title>
          <Text c="dimmed">
            {eventTypeState === 'notFound' ? t.eventTypeNotFound : errorsText.network}
          </Text>
          {backToCatalog}
        </Stack>
      </Container>
    )
  }

  if (confirmed) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="lg" maw={480} mx="auto" w="100%">
          <Title order={1}>{t.confirmedTitle}</Title>
          <Card component="article" withBorder p="lg">
            <Stack gap="xs">
              {eventType && <Text fw={700}>{eventType.name}</Text>}
              <Text size="sm">
                {`${t.whenLabel}: ${formatLocalDateTime(confirmed.start)} (${timezone})`}
              </Text>
              <Text c="dimmed" size="sm">
                {`${confirmed.durationMinutes} ${shared.minutesSuffix}`}
              </Text>
              <Text size="sm">{`${t.guestLabel}: ${confirmed.guestName}`}</Text>
            </Stack>
          </Card>
        </Stack>
      </Container>
    )
  }

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          {backToCatalog}
          <Title order={1}>{eventType?.name ?? t.title}</Title>
        </Stack>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Card component="section" withBorder p="lg">
              <Stack gap="md">
                <Box>
                  <Text c="dimmed" size="sm">
                    {t.ownerLabel}
                  </Text>
                  <Text fw={700}>{ownerEmail}</Text>
                </Box>
                {eventType && (
                  <Box>
                    <Text c="dimmed" size="sm">
                      {eventType.description}
                    </Text>
                    <Text size="sm" fw={700} mt="xs">
                      {`${t.durationLabel}: ${eventType.durationMinutes} ${shared.minutesSuffix}`}
                    </Text>
                  </Box>
                )}
                <Text c="dimmed" size="xs">
                  {`${t.timezoneLabel}: ${timezone}`}
                </Text>
              </Stack>
            </Card>

            <Card component="section" withBorder p="lg">
              <Stack gap="xs">
                <Title order={3}>{t.dayLabel}</Title>
                <DatePicker
                  size="md"
                  value={selectedDate}
                  onChange={(value) => {
                    if (!value) return
                    setSelectedDate(value)
                    setSelectedStart(null)
                    setSlotTaken(false)
                  }}
                  minDate={today}
                  maxDate={addDays(today, BOOKING_WINDOW_DAYS)}
                  excludeDate={(date) => freeCount(date) === 0}
                  renderDay={(date) => {
                    const free = freeCount(date)
                    return (
                      <Stack gap={0} align="center">
                        <span>{Number(date.slice(8, 10))}</span>
                        <Text component="span" size="9px" c="dimmed">
                          {free > 0 ? `${free} ${t.freeCountSuffix}` : ' '}
                        </Text>
                      </Stack>
                    )
                  }}
                />
              </Stack>
            </Card>

            <Card component="section" withBorder p="lg">
              <Stack gap="xs">
                <Title order={3}>{t.timeLabel}</Title>
                {slotTaken && (
                  <Text c="red" size="sm">
                    {t.slotTaken}
                  </Text>
                )}
                {slotsState === 'error' && (
                  <Text c="dimmed" size="sm">
                    {errorsText.network}
                  </Text>
                )}
                {slotsState === 'ready' && slots.length === 0 && (
                  <Text c="dimmed" size="sm">
                    {t.noAvailability}
                  </Text>
                )}
                {slotsState === 'ready' &&
                  slots.length > 0 &&
                  slotsForSelectedDay.length === 0 && (
                    <Text c="dimmed" size="sm">
                      {t.noSlotsForDay}
                    </Text>
                  )}
                {slotsState === 'ready' &&
                  slotsForSelectedDay.map((slot) => (
                    <SlotRow
                      key={slot.start}
                      slot={slot}
                      selected={selectedStart === slot.start}
                      freeLabel={t.statusFree}
                      busyLabel={t.statusBusy}
                      onSelect={() => {
                        setSelectedStart(slot.start)
                        setSlotTaken(false)
                        setBookingErrors({})
                      }}
                    />
                  ))}
              </Stack>
            </Card>
        </SimpleGrid>

        {selectedStart && (
          <Card component="section" withBorder p="lg" maw={480}>
            <form onSubmit={submitBooking} noValidate>
              <Stack gap="md">
                <Text size="sm" fw={700}>
                  {`${formatLocalTime(selectedStart)} · ${eventType?.durationMinutes ?? ''} ${shared.minutesSuffix}`}
                </Text>
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
          </Card>
        )}
      </Stack>
    </Container>
  )
}

function SlotRow({
  slot,
  selected,
  freeLabel,
  busyLabel,
  onSelect,
}: {
  slot: Slot
  selected: boolean
  freeLabel: string
  busyLabel: string
  onSelect: () => void
}) {
  const busy = slot.status === 'busy'
  const range = `${formatLocalTime(slot.start)} - ${formatLocalTime(slot.end)}`
  const busyColor = busy ? 'gray.6' : undefined

  return (
    <Button
      justify="space-between"
      variant={selected ? 'filled' : 'default'}
      disabled={busy}
      data-status={slot.status}
      aria-pressed={selected}
      onClick={onSelect}
      bg={busy ? 'gray.2' : undefined}
      c={busyColor}
      // Mantine's own disabled look reads too close to the enabled
      // `variant="default"` button; override it with an explicit grey and
      // cancel the default dimming it'd otherwise add on top.
      style={busy ? { opacity: 1 } : undefined}
      rightSection={
        <Text component="span" size="xs" fw={700} c={busyColor}>
          {busy ? busyLabel : freeLabel}
        </Text>
      }
    >
      {range}
    </Button>
  )
}
