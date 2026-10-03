import { Box, Button, Container, Stack, Text, Title } from '@mantine/core'
import { useLanding } from '../i18n.tsx'
import { createMeetingHref } from '../links.ts'

export function CtaSection() {
  const t = useLanding()
  return (
    <Box component="section" id="cta" style={{ scrollMarginTop: 80 }}>
      <Container size="sm" py="xl">
        <Stack gap="md" align="center">
          <Title order={2} ta="center">
            {t.cta.heading}
          </Title>
          <Text c="dimmed" ta="center">
            {t.cta.body}
          </Text>
          <Button component="a" href={createMeetingHref} size="lg">
            {t.createMeeting}
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
