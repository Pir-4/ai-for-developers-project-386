import { createContext, useContext, useState, type ReactNode } from 'react'
import { defaultLocale, landingCopy, type Locale } from './content/landing.ts'

type LandingLocaleValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LandingLocaleContext = createContext<LandingLocaleValue>({
  locale: defaultLocale,
  setLocale: () => {},
})

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(defaultLocale)

  return (
    <LandingLocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LandingLocaleContext.Provider>
  )
}

export function useLandingLocale() {
  return useContext(LandingLocaleContext)
}

export function useLanding() {
  const { locale } = useContext(LandingLocaleContext)
  return landingCopy[locale]
}
