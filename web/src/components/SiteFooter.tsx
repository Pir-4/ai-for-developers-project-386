import { Anchor, Box, Container, Group, Stack, Text } from '@mantine/core'
import { landing } from '../content/landing.ts'
import {
  audiencesHref,
  githubHref,
  hexletHref,
  howHref,
} from '../links.ts'

type FooterLink = {
  readonly label: string
  readonly href: string
  readonly external?: boolean
}

const columns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: landing.footer.product,
    links: [
      { label: landing.nav.how, href: howHref },
      { label: landing.nav.owners, href: audiencesHref },
    ],
  },
  {
    heading: landing.footer.project,
    links: [
      { label: landing.footer.github, href: githubHref, external: true },
      { label: landing.footer.hexlet, href: hexletHref, external: true },
    ],
  },
]

export function SiteFooter() {
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
