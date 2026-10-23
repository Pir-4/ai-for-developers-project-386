import { BrowserRouter, Route, Routes } from 'react-router'
import { AppShell } from '@mantine/core'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'
import { GuestCatalogPage } from './pages/GuestCatalogPage.tsx'
import { GuestPage } from './pages/GuestPage.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { OwnerPage } from './pages/OwnerPage.tsx'

// Client routes: / — landing, /owner — the single owner's area (no login),
// /book — the owner's event types; /book/:eventTypeId — a date and a slot of that type.
function App() {
  return (
    <BrowserRouter>
      <AppShell header={{ height: 60 }} padding="md">
        <SiteHeader />
        <AppShell.Main>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/owner" element={<OwnerPage />} />
            <Route path="/book" element={<GuestCatalogPage />} />
            <Route path="/book/:eventTypeId" element={<GuestPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AppShell.Main>
        <SiteFooter />
      </AppShell>
    </BrowserRouter>
  )
}

export default App
