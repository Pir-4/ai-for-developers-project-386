import { AppShell, Anchor, Button, Group } from '@mantine/core'
import { landing } from '../content/landing.ts'
import { audiencesHref, createMeetingHref, howHref } from '../links.ts'

export function SiteHeader() {
  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between">
        <Anchor href="/" fw={700} underline="never">
          {landing.logo}
        </Anchor>
        <Group gap="md" visibleFrom="sm">
          <Anchor href={howHref} size="sm" underline="never">
            {landing.nav.how}
          </Anchor>
          <Anchor href={audiencesHref} size="sm" underline="never">
            {landing.nav.owners}
          </Anchor>
        </Group>
        <Button component="a" href={createMeetingHref} size="sm">
          {landing.createMeeting}
        </Button>
      </Group>
    </AppShell.Header>
  )
}
