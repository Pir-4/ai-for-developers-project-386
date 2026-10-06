import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import {
  ActionIcon,
  Box,
  Button,
  Card,
  Container,
  CopyButton,
  SimpleGrid,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { DatePicker } from '@mantine/dates'
import {
  ApiAvailabilityConflictError,
  ApiValidationError,
  listAvailability,
  listMeetings,
  setAvailability,
  type BlockingMeeting,
  type DayAvailability,
  type Meeting,
} from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { guestHref } from '../links.ts'
import {
  formatLocalDateTime,
  formatLocalTime,
  localDateOf,
  localTimezone,
  quarterHourOptions,
  toDateString,
  toUtcInstant,
} from '../localTime.ts'

const BOOKING_WINDOW_DAYS = 14

type Draft = { from: string; to: string }

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

function draftsOverlap(drafts: Draft[]): boolean {
  const sorted = [...drafts].sort((a, b) => a.from.localeCompare(b.from))
  return sorted.some(
    (draft, index) => index > 0 && draft.from < sorted[index - 1]!.to,
  )
}

/**
 * Owner area (/owner/:email): the calendar they fill in, the link they share,
 * and the meetings that came of it — one page, so narrowing a day and seeing
 * what already sits in it never needs a navigation.
 */
export function OwnerPage() {
  const { email = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const t = useAppText().owner
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [availability, setAvailabilityState] = useState<DayAvailability[]>([])
  const [loadFailed, setLoadFailed] = useState(false)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingsFailed, setMeetingsFailed] = useState(false)

  const today = useMemo(() => startOfToday(), [])
  const [selectedDate, setSelectedDate] = useState(() => toDateString(today))
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [blocking, setBlocking] = useState<BlockingMeeting[]>([])

  const timezone = useMemo(() => localTimezone(), [])
  const options = useMemo(() => quarterHourOptions(), [])

  useEffect(() => {
    let cancelled = false
    listAvailability(ownerEmail)
      .then((loaded) => {
        if (!cancelled) setAvailabilityState(loaded)
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail])

  useEffect(() => {
    let cancelled = false
    listMeetings(ownerEmail)
      .then((loaded) => {
        if (!cancelled) setMeetings(loaded)
      })
      .catch(() => {
        if (!cancelled) setMeetingsFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail])

  const byDate = useMemo(() => {
    const map = new Map<string, DayAvailability>()
    for (const day of availability) map.set(day.date, day)
    return map
  }, [availability])

  // Binned by the owner's own local date — this page is the owner's, so the
  // viewer's local calendar (see localDateOf) is the owner's local calendar.
  const meetingDates = useMemo(() => {
    const set = new Set<string>()
    for (const meeting of meetings) set.add(localDateOf(meeting.start))
    return set
  }, [meetings])

  // Switching days loads that day's stored hours into the editor.
  useEffect(() => {
    const day = byDate.get(selectedDate)
    setDrafts(
      (day?.intervals ?? []).map((interval) => ({
        from: formatLocalTime(interval.start),
        to: formatLocalTime(interval.end),
      })),
    )
    setFormError(null)
    setBlocking([])
    // savedAt is deliberately not cleared here: a successful save changes
    // `byDate`, which re-runs this effect, and clearing would wipe the
    // confirmation the owner just earned. Switching days clears it instead.
  }, [selectedDate, byDate])

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((previous) =>
      previous.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    )
    setSavedAt(null)
  }

  async function save() {
    setFormError(null)
    setBlocking([])

    if (drafts.some((draft) => !(draft.from < draft.to))) {
      setFormError(t.intervalInvalid)
      return
    }
    if (draftsOverlap(drafts)) {
      setFormError(t.intervalsOverlap)
      return
    }

    setSaving(true)
    try {
      const saved = await setAvailability(
        ownerEmail,
        selectedDate,
        drafts.map((draft) => ({
          start: toUtcInstant(selectedDate, draft.from),
          end: toUtcInstant(selectedDate, draft.to),
        })),
      )
      setAvailabilityState((previous) => [
        ...previous.filter((day) => day.date !== saved.date),
        ...(saved.intervals.length > 0 ? [saved] : []),
      ])
      setSavedAt(selectedDate)
    } catch (err) {
      if (err instanceof ApiAvailabilityConflictError) {
        setBlocking(err.meetings)
        setFormError(t.conflictTitle)
      } else if (err instanceof ApiValidationError) {
        setFormError(err.errors[0]?.message ?? t.saveError)
      } else {
        setFormError(errorsText.network)
      }
    } finally {
      setSaving(false)
    }
  }

  const guestUrl = `${window.location.origin}${guestHref(ownerEmail)}`

  return (
    <Container size="lg" py="xl">
      <Stack gap="xl">
        <Title order={1}>{t.title}</Title>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Card component="section" withBorder p="lg">
              <Stack gap="xs">
                <Title order={2}>{t.calendarTitle}</Title>
                <Text c="dimmed" size="sm">
                  {t.calendarHint}
                </Text>
                {loadFailed && (
                  <Text c="dimmed" size="sm">
                    {t.loadError}
                  </Text>
                )}
                <DatePicker
                  value={selectedDate}
                  onChange={(value) => {
                    if (!value) return
                    setSelectedDate(value)
                    setSavedAt(null)
                  }}
                  minDate={today}
                  maxDate={addDays(today, BOOKING_WINDOW_DAYS)}
                  getDayProps={(date) => {
                    const hasAvailability = byDate.has(date)
                    const hasMeeting = meetingDates.has(date)
                    return {
                      'data-open': hasAvailability ? 'true' : undefined,
                      'data-has-meeting': hasMeeting ? 'true' : undefined,
                      style: {
                        ...(hasAvailability ? { fontWeight: 700 } : undefined),
                        ...(hasMeeting
                          ? {
                              textDecoration: 'underline',
                              textDecorationColor: 'var(--mantine-color-blue-6)',
                              textDecorationThickness: 2,
                            }
                          : undefined),
                      },
                    }
                  }}
                />
                <Text c="dimmed" size="xs">
                  {`${t.timezoneLabel}: ${timezone}`}
                </Text>
              </Stack>
            </Card>

            <Card component="section" withBorder p="lg">
              <Stack gap="md">
                <Title order={2}>{`${t.dayTitle}: ${selectedDate}`}</Title>

                {drafts.length === 0 && (
                  <Text c="dimmed" size="sm">
                    {t.dayClosed}
                  </Text>
                )}

                {drafts.map((draft, index) => (
                  <Group key={index} gap="xs" wrap="nowrap" align="flex-end">
                    <Select
                      label={t.fromLabel}
                      data={options}
                      value={draft.from}
                      allowDeselect={false}
                      onChange={(value) => value && updateDraft(index, { from: value })}
                    />
                    <Select
                      label={t.toLabel}
                      data={options}
                      value={draft.to}
                      allowDeselect={false}
                      onChange={(value) => value && updateDraft(index, { to: value })}
                    />
                    <ActionIcon
                      variant="default"
                      size="lg"
                      aria-label={t.removeInterval}
                      onClick={() =>
                        setDrafts((previous) => previous.filter((_, i) => i !== index))
                      }
                    >
                      ×
                    </ActionIcon>
                  </Group>
                ))}

                <Group gap="xs">
                  <Button
                    variant="default"
                    onClick={() =>
                      setDrafts((previous) => [...previous, { from: '11:00', to: '15:00' }])
                    }
                  >
                    {t.addInterval}
                  </Button>
                  <Button onClick={save} loading={saving}>
                    {t.save}
                  </Button>
                </Group>

                {savedAt === selectedDate && (
                  <Text c="green" size="sm">
                    {t.saved}
                  </Text>
                )}
                {formError && (
                  <Text c="red" size="sm">
                    {formError}
                  </Text>
                )}
                {blocking.map((meeting) => (
                  <Text key={meeting.start} c="red" size="sm">
                    {`${formatLocalDateTime(meeting.start)} — ${meeting.guestName}`}
                  </Text>
                ))}
              </Stack>
            </Card>
        </SimpleGrid>

        <Card component="section" withBorder p="lg">
          <Stack gap="xs">
            <Title order={2}>{t.guestLinkTitle}</Title>
            <Text c="dimmed" size="sm">
              {t.guestLinkHint}
            </Text>
            <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
              {guestUrl}
            </Text>
            <CopyButton value={guestUrl} timeout={2000}>
              {({ copied, copy }) => (
                <Button
                  onClick={copy}
                  variant={copied ? 'filled' : 'default'}
                  size="compact-sm"
                  style={{ alignSelf: 'flex-start' }}
                >
                  {copied ? t.copied : t.copy}
                </Button>
              )}
            </CopyButton>
          </Stack>
        </Card>

        <Box component="section">
          <Stack gap="md">
            <Title order={2}>{t.meetingsTitle}</Title>
            {meetingsFailed ? (
              <Text c="dimmed" size="sm">
                {t.meetingsLoadError}
              </Text>
            ) : meetings.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t.meetingsEmpty}
              </Text>
            ) : (
              meetings.map((meeting) => (
                <Card key={meeting.id} component="article" withBorder p="lg">
                  <Stack gap="xs">
                    <Text size="sm">
                      {`${t.whenLabel}: ${formatLocalDateTime(meeting.start)} (${timezone})`}
                    </Text>
                    <Text c="dimmed" size="sm">
                      {`${meeting.durationMinutes} ${shared.minutesSuffix}`}
                    </Text>
                    <Text size="sm">
                      {`${t.guestLabel}: ${meeting.guestName} <${meeting.guestEmail}>`}
                    </Text>
                  </Stack>
                </Card>
              ))
            )}
          </Stack>
        </Box>
      </Stack>
    </Container>
  )
}
