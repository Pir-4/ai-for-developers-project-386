import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Box, Card, Container, Stack, Text, Title } from '@mantine/core'
import { listEventTypes, type EventType } from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { guestHref } from '../links.ts'

// Card row, per docs/ui-style.md: CSS grid auto-fit, no breakpoint JS.
const cardGridStyle = {
  display: 'grid',
  gap: 'var(--mantine-spacing-md)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
} as const

// Guest entry point (/book/:email): the owner's booking types catalog —
// picking a card leads to the calendar page (/book/:email/:id).
export function GuestCatalogPage() {
  const { email = '' } = useParams()
  const ownerEmail = decodeURIComponent(email)
  const t = useAppText().guestCatalog
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<EventType[]>([])

  useEffect(() => {
    let cancelled = false
    setState('loading')
    listEventTypes(ownerEmail)
      .then((loaded) => {
        if (cancelled) return
        setItems(loaded)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })
    return () => {
      cancelled = true
    }
  }, [ownerEmail])

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1}>{t.title}</Title>
          <Text c="dimmed">{t.hint}</Text>
        </Stack>
        {state === 'error' && (
          <Text c="dimmed" size="sm">
            {errorsText.network}
          </Text>
        )}
        {state === 'ready' && items.length === 0 && (
          <Text c="dimmed" size="sm">
            {t.empty}
          </Text>
        )}
        {state === 'ready' && items.length > 0 && (
          <Box style={cardGridStyle}>
            {items.map((item) => (
              <Card
                key={item.id}
                component={Link}
                to={guestHref(ownerEmail, item.id)}
                withBorder
                p="lg"
              >
                <Stack gap="xs">
                  <Title order={3}>{item.name}</Title>
                  <Text c="dimmed" size="sm">
                    {item.description}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {item.duration} {shared.minutesSuffix}
                  </Text>
                </Stack>
              </Card>
            ))}
          </Box>
        )}
      </Stack>
    </Container>
  )
}
