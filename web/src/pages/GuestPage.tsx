import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import {
  Box,
  Button,
  Card,
  Container,
  SimpleGrid,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import {
  ApiConflictError,
  ApiValidationError,
  MEETING_DURATIONS,
  createBooking,
  listSlots,
  type Booking,
  type MeetingDuration,
  type Slot,
} from '../api.ts'
import { useAppText } from '../i18n.tsx'
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
 * Guest entry point (/book/:email): the owner's calendar.
 *
 * The slots API answers flat; the binning into calendar days happens here, in
 * the guest's own timezone, so a cell at the edge of a day lands on the date
 * the guest would call it (see issue #39).
 */
export function GuestPage() {
  const { email = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const t = useAppText().guest
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [duration, setDuration] = useState<MeetingDuration>(30)
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
    setSlotsState('loading')
    setSelectedStart(null)
    listSlots(ownerEmail, duration)
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
  }, [ownerEmail, duration])

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
        await createBooking(ownerEmail, {
          guestName: name,
          guestEmail: mail,
          start: selectedStart,
          durationMinutes: duration,
        }),
      )
    } catch (err) {
      if (err instanceof ApiConflictError) {
        setSlotTaken(true)
        setSelectedStart(null)
        try {
          setSlots(await listSlots(ownerEmail, duration))
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

  if (confirmed) {
    return (
      <Container size="sm" py="xl">
        <Stack gap="lg" maw={480} mx="auto" w="100%">
          <Title order={1}>{t.confirmedTitle}</Title>
          <Card component="article" withBorder p="lg">
            <Stack gap="xs">
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
        <Title order={1}>{t.title}</Title>

        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            <Card component="section" withBorder p="lg">
              <Stack gap="md">
                <Box>
                  <Text c="dimmed" size="sm">
                    {t.ownerLabel}
                  </Text>
                  <Text fw={700}>{ownerEmail}</Text>
                </Box>
                <Box>
                  <Text component="label" size="sm" fw={700} id="duration-label">
                    {t.durationLabel}
                  </Text>
                  <SegmentedControl
                    fullWidth
                    mt="xs"
                    aria-labelledby="duration-label"
                    value={String(duration)}
                    onChange={(value) => setDuration(Number(value) as MeetingDuration)}
                    data={MEETING_DURATIONS.map((minutes) => ({
                      value: String(minutes),
                      label: `${minutes} ${shared.minutesSuffix}`,
                    }))}
                  />
                </Box>
                <Text c="dimmed" size="xs">
                  {`${t.timezoneLabel}: ${timezone}`}
                </Text>
              </Stack>
            </Card>

            <Card component="section" withBorder p="lg">
              <Stack gap="xs">
                <Title order={3}>{t.dayLabel}</Title>
                <DatePicker
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
                  renderDay={(date) => (
                    <Stack gap={0} align="center">
                      <span>{Number(date.slice(8, 10))}</span>
                      {freeCount(date) > 0 && (
                        <Text component="span" size="9px" c="dimmed">
                          {`${freeCount(date)} ${t.freeCountSuffix}`}
                        </Text>
                      )}
                    </Stack>
                  )}
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
                  {`${formatLocalTime(selectedStart)} · ${duration} ${shared.minutesSuffix}`}
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

  return (
    <Button
      justify="space-between"
      variant={selected ? 'filled' : 'default'}
      disabled={busy}
      data-status={slot.status}
      aria-pressed={selected}
      onClick={onSelect}
      rightSection={
        <Text component="span" size="xs" fw={700}>
          {busy ? busyLabel : freeLabel}
        </Text>
      }
    >
      {range}
    </Button>
  )
}
