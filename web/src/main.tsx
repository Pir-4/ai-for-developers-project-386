import { MantineProvider } from '@mantine/core'
import '@mantine/core/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { LandingLocaleProvider } from './i18n.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <LandingLocaleProvider>
        <App />
      </LandingLocaleProvider>
    </MantineProvider>
  </StrictMode>,
)
