import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Box, Card, Container, Stack, Text, Title } from '@mantine/core'
import { listEventTypes, type EventType } from '../api.ts'
import { useAppText } from '../i18n.tsx'
import { eventTypeHref } from '../links.ts'
import { useOwner } from '../useOwner.ts'

// Card row, per docs/ui-style.md: CSS grid auto-fit, no breakpoint JS.
const cardGridStyle = {
  display: 'grid',
  gap: 'var(--mantine-spacing-md)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
} as const

/**
 * Guest entry point (/book): the owner's event types. Picking a card leads to
 * that type's page (/book/:eventTypeId) — a date, then a slot.
 */
export function GuestCatalogPage() {
  const owner = useOwner()
  const t = useAppText().guestCatalog
  const errorsText = useAppText().errors
  const shared = useAppText().shared

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [items, setItems] = useState<EventType[]>([])

  useEffect(() => {
    let cancelled = false
    setState('loading')
    listEventTypes()
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
  }, [])

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap="xs">
          <Title order={1}>{t.title}</Title>
          {owner && <Text c="dimmed">{`${t.ownerLabel} ${owner.name}`}</Text>}
          <Text c="dimmed" size="sm">
            {t.hint}
          </Text>
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
                to={eventTypeHref(item.id)}
                withBorder
                p="lg"
              >
                <Stack gap="xs">
                  <Title order={3}>{item.name}</Title>
                  <Text c="dimmed" size="sm">
                    {item.description}
                  </Text>
                  <Text fw={700} size="sm">
                    {`${item.durationMinutes} ${shared.minutesSuffix}`}
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
