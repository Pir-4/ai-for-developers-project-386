import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Button, Container, Stack, Text, TextInput, Title } from '@mantine/core'
import { useAppText } from '../i18n.tsx'
import { ownerHref } from '../links.ts'

// "The last used email" of the owner — prefilled on the next visit.
const EMAIL_KEY = 'owner.email'

// Pragmatic "looks like an email" check, not stricter than the server's.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const t = useAppText().login
  const navigate = useNavigate()
  const [email, setEmail] = useState(() => {
    try {
      return window.localStorage.getItem(EMAIL_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = email.trim()
    if (!EMAIL_RE.test(value)) {
      setError(t.invalidEmail)
      return
    }

    setError('')
    try {
      window.localStorage.setItem(EMAIL_KEY, value)
    } catch {
      // persistence is best-effort
    }
    navigate(ownerHref(value))
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg" maw={480} mx="auto" w="100%">
        <Title order={1}>{t.title}</Title>
        <Text c="dimmed">{t.hint}</Text>
        <form onSubmit={submit} noValidate>
          <Stack gap="md">
            <TextInput
              label={t.emailLabel}
              type="email"
              value={email}
              error={error}
              onChange={(event) => setEmail(event.currentTarget.value)}
            />
            <Button type="submit">{t.submit}</Button>
          </Stack>
        </form>
      </Stack>
    </Container>
  )
}
