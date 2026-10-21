// All navigation targets of the app in one place.
// Client routes (react-router): /, /login, /owner/:email, /book/:email, /book/:email/:eventTypeId.

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

// The owner's event-type catalog — the link the owner shares; the guest starts by picking a type.
export const guestHref = (email: string) => `/book/${encodeURIComponent(email)}`

// One event type's booking page: a date, then a free slot of that type's length.
export const eventTypeHref = (email: string, eventTypeId: number) =>
  `${guestHref(email)}/${eventTypeId}`
