import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { Box, Button, Card, Container, Stack, Text, Title } from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import { listEventTypes, listSlots, type EventType } from '../api.ts'
import { useAppText } from '../i18n.tsx'

// Button grid: CSS grid auto-fit, no breakpoint JS (same spirit as the card
// rows in docs/ui-style.md, sized for short time labels instead of cards).
const slotGridStyle = {
  display: 'grid',
  gap: 'var(--mantine-spacing-xs)',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
} as const

// 'YYYY-MM-DD' in the viewer's local calendar, matching Mantine's DatePicker value format.
function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

// HH:mm in the viewer's local time — the slot grid is always :00/:30.
function formatLocalTime(iso: string): string {
  const date = new Date(iso)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

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

  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )

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
                      onClick={() => setSelectedStart(start)}
                      aria-pressed={selectedStart === start}
                    >
                      {formatLocalTime(start)}
                    </Button>
                  ))}
                </Box>
              )}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Container>
  )
}
