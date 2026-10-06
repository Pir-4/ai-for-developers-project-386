import { AudiencesSection } from '../components/AudiencesSection.tsx'
import { CtaSection } from '../components/CtaSection.tsx'
import { HeroSection } from '../components/HeroSection.tsx'
import { HowItWorksSection } from '../components/HowItWorksSection.tsx'

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <AudiencesSection />
      <CtaSection />
    </>
  )
}
