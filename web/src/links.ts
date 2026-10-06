// All navigation targets of the app in one place.
// Client routes (react-router): /, /login, /owner/:email, /book/:email.

export const homeHref = '/'

// Landing anchors are addressed as /#id — they work from any page, not just the landing.
export const howHref = '/#how'
export const audiencesHref = '/#audiences'

// Landing CTAs lead to the owner area (bare /owner redirects to /login).
export const createMeetingHref = '/owner'

export const githubHref =
  'https://github.com/Pir-4/ai-for-developers-project-386'
export const hexletHref = 'https://ru.hexlet.io/programs/ai-for-developers'

// The owner area of a specific owner (email is the key, no accounts).
export const ownerHref = (email: string) => `/owner/${encodeURIComponent(email)}`

// The link to an owner's calendar — the single link the owner shares.
export const guestHref = (email: string) => `/book/${encodeURIComponent(email)}`
