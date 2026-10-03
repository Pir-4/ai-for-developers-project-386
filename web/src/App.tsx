import { AppShell } from '@mantine/core'
import { AudiencesSection } from './components/AudiencesSection.tsx'
import { CtaSection } from './components/CtaSection.tsx'
import { HeroSection } from './components/HeroSection.tsx'
import { HowItWorksSection } from './components/HowItWorksSection.tsx'
import { SiteFooter } from './components/SiteFooter.tsx'
import { SiteHeader } from './components/SiteHeader.tsx'

function App() {
  return (
    <AppShell header={{ height: 60 }} padding="md">
      <SiteHeader />
      <AppShell.Main>
        <HeroSection />
        <HowItWorksSection />
        <AudiencesSection />
        <CtaSection />
      </AppShell.Main>
      <SiteFooter />
    </AppShell>
  )
}

export default App
