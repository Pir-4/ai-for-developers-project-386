import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { defaultLocale, landingCopy, type Locale } from './content/landing.ts'

const STORAGE_KEY = 'ui.locale'

type LandingLocaleValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LandingLocaleContext = createContext<LandingLocaleValue>({
  locale: defaultLocale,
  setLocale: () => {},
})

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'ru' || stored === 'en' ? stored : defaultLocale
  } catch {
    // storage unavailable (e.g. private mode) — default locale
    return defaultLocale
  }
}

export function LandingLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(readStoredLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    try {
      window.localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // persistence is best-effort
    }
  }, [locale])

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
