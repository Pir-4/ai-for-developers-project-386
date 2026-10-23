// All navigation targets of the app in one place.
// Client routes (react-router): /, /owner, /book, /book/:eventTypeId.

export const homeHref = '/'

// Landing anchors are addressed as /#id — they work from any page, not just the landing.
export const howHref = '/#how'
export const audiencesHref = '/#audiences'

export const githubHref =
  'https://github.com/Pir-4/ai-for-developers-project-386'
export const hexletHref = 'https://ru.hexlet.io/programs/ai-for-developers'

// The owner area: the single predefined owner, no login.
export const ownerHref = '/owner'

// The guest's entry point — the owner's event-type catalog; landing CTAs lead here.
export const guestHref = '/book'

// One event type's booking page: a date, then a free 30-minute slot.
export const eventTypeHref = (eventTypeId: number) => `${guestHref}/${eventTypeId}`
