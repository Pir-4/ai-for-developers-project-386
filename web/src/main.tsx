import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import '@mantine/dates/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { LocaleProvider } from './i18n.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </MantineProvider>
  </StrictMode>,
)
