import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import {
  Box,
  Button,
  Card,
  Container,
  CopyButton,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import {
  ApiValidationError,
  createEventType,
  listEventTypes,
  listMeetings,
  type CreateEventTypeBody,
  type EventType,
  type Meeting,
} from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { guestHref } from '../links.ts'
import { formatLocalDateTime, localTimezone } from '../localTime.ts'

type FieldName = 'name' | 'description' | 'duration'
type FieldErrors = Partial<Record<FieldName | 'form', string>>

// Limits mirror the contract (contract/main.tsp, CreateEventTypeBody).
const NAME_MAX = 100
const DESCRIPTION_MAX = 500
const DURATION_MIN = 15
const DURATION_MAX = 240
const DURATION_STEP = 15
const DURATION_DEFAULT = 30

function durationMinutes(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60000)
}

/** duration из NumberInput либо валидно, либо null (правила — как в контракте). */
function parseDuration(value: number | string): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (
    !Number.isInteger(parsed) ||
    parsed < DURATION_MIN ||
    parsed > DURATION_MAX ||
    parsed % DURATION_STEP !== 0
  ) {
    return null
  }
  return parsed
}

export function OwnerPage() {
  const { email = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const t = useAppText().owner
  const errorsText = useAppText().errors

  const [items, setItems] = useState<EventType[]>([])
  const [listFailed, setListFailed] = useState(false)

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingsFailed, setMeetingsFailed] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [duration, setDuration] = useState<number | string>(DURATION_DEFAULT)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    listEventTypes(ownerEmail)
      .then((loaded) => {
        if (!cancelled) setItems(loaded)
      })
      .catch(() => {
        if (!cancelled) setListFailed(true)
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

  function validate(): { errors: FieldErrors; body: CreateEventTypeBody | null } {
    const parsedDuration = parseDuration(duration)
    const errors: FieldErrors = {}
    if (name.length < 1) errors.name = t.nameRequired
    else if (name.length > NAME_MAX) errors.name = t.nameTooLong
    if (description.length < 1) errors.description = t.descriptionRequired
    else if (description.length > DESCRIPTION_MAX)
      errors.description = t.descriptionTooLong
    if (parsedDuration === null) errors.duration = t.durationInvalid

    const body =
      parsedDuration === null || Object.keys(errors).length > 0
        ? null
        : { name, description, duration: parsedDuration }
    return { errors, body }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const { errors, body } = validate()
    setFieldErrors(errors)
    if (body === null) return

    setSaving(true)
    try {
      const created = await createEventType(ownerEmail, body)
      setItems((previous) => [...previous, created])
      setName('')
      setDescription('')
      setDuration(DURATION_DEFAULT)
      setFieldErrors({})
    } catch (err) {
      if (err instanceof ApiValidationError) {
        const serverErrors: FieldErrors = {}
        for (const issue of err.errors) {
          const field = issue.path as FieldName
          if (field === 'name' || field === 'description' || field === 'duration') {
            if (!(field in serverErrors)) serverErrors[field] = issue.message
          } else if (serverErrors.form === undefined) {
            serverErrors.form = issue.message
          }
        }
        setFieldErrors(serverErrors)
      } else {
        setFieldErrors({ form: errorsText.network })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="xl">
        <Title order={1}>{t.title}</Title>

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
              <Stack gap="md">
                {meetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>

        <Box component="section">
          <Stack gap="lg" maw={480}>
            <Title order={2}>{t.formTitle}</Title>
            <form onSubmit={submit} noValidate>
              <Stack gap="md">
                <TextInput
                  label={t.nameLabel}
                  value={name}
                  error={fieldErrors.name}
                  maxLength={NAME_MAX}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
                <Textarea
                  label={t.descriptionLabel}
                  value={description}
                  error={fieldErrors.description}
                  maxLength={DESCRIPTION_MAX}
                  autosize
                  minRows={2}
                  onChange={(event) => setDescription(event.currentTarget.value)}
                />
                <NumberInput
                  label={t.durationLabel}
                  value={duration}
                  error={fieldErrors.duration}
                  min={DURATION_MIN}
                  max={DURATION_MAX}
                  step={DURATION_STEP}
                  onChange={(value) => setDuration(value)}
                />
                <Button type="submit" loading={saving}>
                  {t.create}
                </Button>
                {fieldErrors.form && (
                  <Text c="red" size="sm">
                    {fieldErrors.form}
                  </Text>
                )}
              </Stack>
            </form>
          </Stack>
        </Box>

        <Box component="section">
          <Stack gap="md">
            <Title order={2}>{t.listTitle}</Title>
            {listFailed ? (
              <Text c="dimmed" size="sm">
                {t.loadError}
              </Text>
            ) : items.length === 0 ? (
              <Text c="dimmed" size="sm">
                {t.empty}
              </Text>
            ) : (
              <Stack gap="md">
                {items.map((item) => (
                  <GuestLinkCard
                    key={item.id}
                    item={item}
                    ownerEmail={ownerEmail}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Container>
  )
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  const t = useAppText().owner
  const shared = useAppText().shared
  const timezone = localTimezone()

  return (
    <Card component="article" withBorder p="lg">
      <Stack gap="xs">
        <Title order={3}>{meeting.eventTypeName}</Title>
        <Text size="sm">
          {`${t.whenLabel}: ${formatLocalDateTime(meeting.start)} (${timezone})`}
        </Text>
        <Text c="dimmed" size="sm">
          {durationMinutes(meeting.start, meeting.end)} {shared.minutesSuffix}
        </Text>
        <Text size="sm">
          {`${t.guestLabel}: ${meeting.guestName} <${meeting.guestEmail}>`}
        </Text>
      </Stack>
    </Card>
  )
}

function GuestLinkCard({
  item,
  ownerEmail,
}: {
  item: EventType
  ownerEmail: string
}) {
  const t = useAppText().owner
  const shared = useAppText().shared
  const url = `${window.location.origin}${guestHref(ownerEmail, item.id)}`

  return (
    <Card component="article" withBorder p="lg">
      <Stack gap="xs">
        <Title order={3}>{item.name}</Title>
        <Text c="dimmed" size="sm">
          {item.description}
        </Text>
        <Text c="dimmed" size="sm">
          {item.duration} {shared.minutesSuffix}
        </Text>
        <Text size="sm" fw={700}>
          {t.guestLinkLabel}
        </Text>
        <Text size="sm" c="dimmed" style={{ wordBreak: 'break-all' }}>
          {url}
        </Text>
        <CopyButton value={url} timeout={2000}>
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
  )
}
