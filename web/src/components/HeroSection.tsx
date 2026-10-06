import { Box, Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from 'react-router'
import { useLanding } from '../i18n.tsx'
import { createMeetingHref, howHref } from '../links.ts'

export function HeroSection() {
  const t = useLanding()
  return (
    <Box component="section">
      <Container size="lg" py="calc(4rem + 6vw)">
        <Stack gap="xl">
          <Title
            order={1}
            fw={900}
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.1 }}
          >
            {t.hero.title}
          </Title>
          <Text size="xl" c="dimmed" maw={620}>
            {t.hero.subtitle}
          </Text>
          <Group gap="md">
            <Button component={Link} to={createMeetingHref} size="lg">
              {t.createMeeting}
            </Button>
            <Button component={Link} to={howHref} size="lg" variant="default">
              {t.nav.how}
            </Button>
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
