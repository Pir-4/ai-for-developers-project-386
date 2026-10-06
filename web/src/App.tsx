import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AppShell } from '@mantine/core'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { GuestPage } from './pages/GuestPage.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { OwnerPage } from './pages/OwnerPage.tsx'

// Client routes: / — landing, /login → /owner/:email (bare /owner redirects),
// /book/:email — the owner's calendar, where the guest picks a length and a time.
function App() {
  return (
    <BrowserRouter>
      <AppShell header={{ height: 60 }} padding="md">
        <SiteHeader />
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/owner" element={<Navigate to="/login" replace />} />
            <Route path="/owner/:email" element={<OwnerPage />} />
            <Route path="/book/:email" element={<GuestPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell.Main>
        <SiteFooter />
      </AppShell>
    </BrowserRouter>
  )
}

export default App
