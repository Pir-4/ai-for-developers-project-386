import { Box, Button, Container, Group, Stack, Text, Title } from '@mantine/core'
import { landing } from '../content/landing.ts'
import { createMeetingHref, howHref } from '../links.ts'

export function HeroSection() {
  return (
    <Box component="section">
      <Container size="lg" py="calc(4rem + 6vw)">
        <Stack gap="xl">
          <Title
            order={1}
            fw={900}
            style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.1 }}
          >
            {landing.hero.title}
          </Title>
          <Text size="xl" c="dimmed" maw={620}>
            {landing.hero.subtitle}
          </Text>
          <Group gap="md">
            <Button component="a" href={createMeetingHref} size="lg">
              {landing.createMeeting}
            </Button>
            <Button component="a" href={howHref} size="lg" variant="default">
              {landing.nav.how}
            </Button>
          </Group>
        </Stack>
      </Container>
    </Box>
  )
}
