import {
  Box,
  Card,
  Container,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useLanding } from '../i18n.tsx'

const stepsGridStyle = {
  listStyleType: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 'var(--mantine-spacing-md)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
} as const

export function HowItWorksSection() {
  const t = useLanding()
  return (
    <Box component="section" id="how" style={{ scrollMarginTop: 80 }}>
      <Container size="lg" py="xl">
        <Stack gap="lg">
          <Title order={2}>{t.how.heading}</Title>
          <Box component="ol" style={stepsGridStyle}>
            {t.how.steps.map((step, index) => (
              <Box component="li" key={step.title}>
                <Card withBorder p="lg" h="100%">
                  <Stack gap="xs">
                    <Text fw={900} size="xl" c="blue">
                      {index + 1}
                    </Text>
                    <Text fw={700}>{step.title}</Text>
                    <Text c="dimmed" size="sm">
                      {step.body}
                    </Text>
                  </Stack>
                </Card>
              </Box>
            ))}
          </Box>
        </Stack>
      </Container>
    </Box>
  )
}
