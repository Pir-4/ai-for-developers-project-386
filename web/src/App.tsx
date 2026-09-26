import {
  AppShell,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { BackendStatus } from './components/BackendStatus.tsx'

function App() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={3}>Запись на звонок</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="sm" py="xl">
          <Stack gap="md">
            <Title order={1}>Запись на звонок</Title>
            <Text c="dimmed">
              Здесь появится сервис бронирования 30-минутных слотов: владелец
              опубликует доступное время, а гость сможет выбрать подходящий слот
              и записаться на звонок.
            </Text>
            <BackendStatus />
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}

export default App
