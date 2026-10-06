import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { appCopy, type AppText } from './content/app.ts'
import { defaultLocale, landingCopy, type Locale } from './content/landing.ts'

const STORAGE_KEY = 'ui.locale'

type LocaleValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleValue>({
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

// The app-wide RU/EN locale: sets <html lang>, persists the choice in
// localStorage['ui.locale'], restores it on mount, falls back to RU.
export function LocaleProvider({ children }: { children: ReactNode }) {
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
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

// Landing page copy (content/landing.ts).
export function useLanding() {
  const { locale } = useLocale()
  return landingCopy[locale]
}

// Copy of the app pages (content/app.ts).
export function useAppText(): AppText {
  const { locale } = useLocale()
  return appCopy[locale]
}
