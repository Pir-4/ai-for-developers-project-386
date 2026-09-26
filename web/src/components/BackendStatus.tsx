import { Badge } from '@mantine/core'
import { useEffect, useState } from 'react'

type BackendState = 'checking' | 'ok' | 'unavailable'

export function BackendStatus() {
  const [state, setState] = useState<BackendState>('checking')

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const response = await fetch('/api/health')
        if (!cancelled) {
          setState(response.ok ? 'ok' : 'unavailable')
        }
      } catch {
        if (!cancelled) {
          setState('unavailable')
        }
      }
    }

    void check()

    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'checking') {
    return (
      <Badge color="gray" variant="light">
        Бэкенд: проверка…
      </Badge>
    )
  }

  if (state === 'ok') {
    return (
      <Badge color="green" variant="light">
        Бэкенд: OK
      </Badge>
    )
  }

  return (
    <Badge color="red" variant="light">
      Бэкенд: недоступен
    </Badge>
  )
}
