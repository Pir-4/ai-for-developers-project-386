import {
  Box,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { landing } from '../content/landing.ts'

export function AudiencesSection() {
  return (
    <Box component="section" id="audiences" style={{ scrollMarginTop: 80 }}>
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Title order={2}>{landing.audiences.heading}</Title>
          <Group gap="md" wrap="wrap">
            {landing.audiences.cards.map((card) => (
              <Card
                key={card.title}
                component="article"
                withBorder
                p="lg"
                style={{ flex: '1 1 260px' }}
              >
                <Stack gap="xs">
                  <Title order={3}>{card.title}</Title>
                  <Text c="dimmed" size="sm">
                    {card.body}
                  </Text>
                </Stack>
              </Card>
            ))}
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
