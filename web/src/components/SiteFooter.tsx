import { Anchor, Box, Container, Group, Stack, Text } from '@mantine/core'
import { useLanding } from '../i18n.tsx'
import {
  audiencesHref,
  githubHref,
  hexletHref,
  howHref,
} from '../links.ts'

type FooterLink = {
  label: string
  href: string
  external?: boolean
}

export function SiteFooter() {
  const t = useLanding()
  const columns: { heading: string; links: FooterLink[] }[] = [
    {
      heading: t.footer.product,
      links: [
        { label: t.nav.how, href: howHref },
        { label: t.nav.owners, href: audiencesHref },
      ],
    },
    {
      heading: t.footer.project,
      links: [
        { label: t.footer.github, href: githubHref, external: true },
        { label: t.footer.hexlet, href: hexletHref, external: true },
      ],
    },
  ]

  return (
    <Box
      component="footer"
      pt="xl"
      pb="lg"
      style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
    >
      <Container size="lg">
        <Group gap="xl" align="start">
          {columns.map((column) => (
            <Stack key={column.heading} gap="xs">
              <Text fw={700} size="sm">
                {column.heading}
              </Text>
              {column.links.map((link) => (
                <Anchor
                  key={link.label}
                  href={link.href}
                  size="sm"
                  {...(link.external
                    ? { target: '_blank', rel: 'noopener noreferrer' }
                    : {})}
                >
                  {link.label}
                </Anchor>
              ))}
            </Stack>
          ))}
        </Group>
      </Container>
    </Box>
  )
}
