import { AppShell, Anchor, Button, Group } from '@mantine/core'
import { useLanding, useLandingLocale } from '../i18n.tsx'
import { audiencesHref, createMeetingHref, howHref } from '../links.ts'

function LocaleSwitcher() {
  const { locale, setLocale } = useLandingLocale()
  return (
    <Group gap={4} aria-label="Language">
      <Button
        size="compact-xs"
        variant={locale === 'ru' ? 'filled' : 'default'}
        aria-pressed={locale === 'ru'}
        onClick={() => setLocale('ru')}
      >
        RU
      </Button>
      <Button
        size="compact-xs"
        variant={locale === 'en' ? 'filled' : 'default'}
        aria-pressed={locale === 'en'}
        onClick={() => setLocale('en')}
      >
        EN
      </Button>
    </Group>
  )
}

export function SiteHeader() {
  const t = useLanding()
  return (
    <AppShell.Header>
      <Group h="100%" px="md" justify="space-between" gap="sm">
        <Anchor href="/" fw={700} underline="never">
          {t.logo}
        </Anchor>
        <Group gap="md" visibleFrom="sm">
          <Anchor href={howHref} size="sm" underline="never">
            {t.nav.how}
          </Anchor>
          <Anchor href={audiencesHref} size="sm" underline="never">
            {t.nav.owners}
          </Anchor>
        </Group>
        <Group gap="sm">
          <LocaleSwitcher />
          <Button component="a" href={createMeetingHref} size="sm">
            {t.createMeeting}
          </Button>
        </Group>
      </Group>
    </AppShell.Header>
  )
}
