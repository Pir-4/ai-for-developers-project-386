import { Box, Button, Container, Stack, Text, Title } from '@mantine/core'
import { landing } from '../content/landing.ts'
import { createMeetingHref } from '../links.ts'

export function CtaSection() {
  return (
    <Box component="section" id="cta" style={{ scrollMarginTop: 80 }}>
      <Container size="sm" py="xl">
        <Stack gap="md" align="center">
          <Title order={2} ta="center">
            {landing.cta.heading}
          </Title>
          <Text c="dimmed" ta="center">
            {landing.cta.body}
          </Text>
          <Button component="a" href={createMeetingHref} size="lg">
            {landing.createMeeting}
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
