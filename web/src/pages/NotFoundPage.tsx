import { Button, Container, Stack, Title } from '@mantine/core'
import { Link } from 'react-router'
import { useAppText } from '../i18n.tsx'

export function NotFoundPage() {
  const t = useAppText().notFound
  return (
    <Container size="sm" py="xl">
      <Stack gap="lg" maw={480} mx="auto" w="100%">
        <Title order={1}>{t.title}</Title>
        <Button component={Link} to="/" variant="default" style={{ alignSelf: 'flex-start' }}>
          {t.toMain}
        </Button>
      </Stack>
    </Container>
  )
}
