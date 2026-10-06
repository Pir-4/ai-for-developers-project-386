// "The last used owner email" — written by LoginPage, read by LoginPage (to
// prefill the form) and SiteHeader (so "My meetings" skips straight to it).
export const OWNER_EMAIL_KEY = 'owner.email'

export function readRememberedOwnerEmail(): string | null {
  try {
    return window.localStorage.getItem(OWNER_EMAIL_KEY)
  } catch {
    return null
  }
}

export function rememberOwnerEmail(email: string): void {
  try {
    window.localStorage.setItem(OWNER_EMAIL_KEY, email)
  } catch {
    // persistence is best-effort
  }
}
