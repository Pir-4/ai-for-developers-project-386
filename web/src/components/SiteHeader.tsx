import { AppShell, Anchor, Button, Group } from '@mantine/core'
import { Link } from 'react-router'
import { useLanding, useLocale } from '../i18n.tsx'
import { audiencesHref, guestHref, howHref, ownerHref } from '../links.ts'

function LocaleSwitcher() {
  const { locale, setLocale } = useLocale()
  return (
    <Group gap={2} wrap="nowrap" aria-label="Language">
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
      <Group h="100%" px="md" justify="space-between" gap="sm" wrap="nowrap">
        <Anchor
          href="/"
          fw={700}
          underline="never"
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'clamp(0.875rem, 2.8vw, 1.1rem)',
          }}
        >
          {t.logo}
        </Anchor>
        <Group gap="md" visibleFrom="xs">
          <Anchor href={howHref} size="sm" underline="never">
            {t.nav.how}
          </Anchor>
          <Anchor href={audiencesHref} size="sm" underline="never">
            {t.nav.owners}
          </Anchor>
          <Anchor component={Link} to={ownerHref} size="sm" underline="never">
            {t.ownerArea}
          </Anchor>
        </Group>
        <Group gap="xs" wrap="nowrap">
          <LocaleSwitcher />
          <Button component={Link} to={guestHref} size="compact-sm">
            {t.bookCall}
          </Button>
        </Group>
      </Group>
    </AppShell.Header>
  )
}
