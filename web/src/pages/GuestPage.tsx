import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { Card, Container, Stack, Text, Title } from '@mantine/core'
import { listEventTypes, type EventType } from '../api.ts'
import { useAppText } from '../i18n.tsx'

// Guest entry point (/book/:email/:id): shows the event type the guest landed
// on. Slot picking arrives in the next slice; this page is the working target
// of the owner's guest link.
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
          <Card component="article" withBorder p="lg">
            <Stack gap="xs">
              <Title order={3}>{eventType.name}</Title>
              <Text c="dimmed" size="sm">
                {eventType.description}
              </Text>
              <Text c="dimmed" size="sm">
                {eventType.duration} {shared.minutesSuffix}
              </Text>
              <Text size="sm">{t.soon}</Text>
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  )
}
