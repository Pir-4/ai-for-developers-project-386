import type { components } from './generated/schema.js'

export type Interval = components['schemas']['Interval']
export type DayAvailability = components['schemas']['DayAvailability']
export type MeetingDuration = components['schemas']['MeetingDuration']
export type Slot = components['schemas']['Slot']
export type ValidationError = components['schemas']['ValidationError']
export type AvailabilityConflictError =
  components['schemas']['AvailabilityConflictError']
export type BlockingMeeting = components['schemas']['BlockingMeeting']
export type Booking = components['schemas']['Booking']
export type CreateBookingBody = components['schemas']['CreateBookingBody']
export type Meeting = components['schemas']['Meeting']

/** The durations a guest may choose from, in the order they are offered. */
export const MEETING_DURATIONS: MeetingDuration[] = [15, 30, 45]

/** 422 from the API — carries per-field errors (path + message). */
export class ApiValidationError extends Error {
  readonly errors: ValidationError['errors']

  constructor(validation: ValidationError) {
    super(validation.message)
    this.name = 'ApiValidationError'
    this.errors = validation.errors
  }
}

/** 409 from the API — the slot was taken in the meantime. */
export class ApiConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiConflictError'
  }
}

/** 409 from the availability PUT — names the meetings holding the day. */
export class ApiAvailabilityConflictError extends Error {
  readonly meetings: BlockingMeeting[]

  constructor(conflict: AvailabilityConflictError) {
    super(conflict.message)
    this.name = 'ApiAvailabilityConflictError'
    this.meetings = conflict.meetings
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    if (response.status === 422) {
      throw new ApiValidationError((await response.json()) as ValidationError)
    }
    if (response.status === 409) {
      const body = (await response.json()) as { message: string; meetings?: BlockingMeeting[] }
      if (body.meetings) {
        throw new ApiAvailabilityConflictError(body as AvailabilityConflictError)
      }
      throw new ApiConflictError(body.message)
    }
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

function ownerUrl(ownerEmail: string): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}`
}

/** The owner's availability across the booking window, oldest date first. */
export function listAvailability(ownerEmail: string): Promise<DayAvailability[]> {
  return requestJson(`${ownerUrl(ownerEmail)}/availability`)
}

/**
 * Replaces one date's availability wholesale; an empty list closes the day.
 * Throws ApiValidationError (422) or ApiAvailabilityConflictError (409 — a
 * booking would be left uncovered).
 */
export function setAvailability(
  ownerEmail: string,
  date: string,
  intervals: Interval[],
): Promise<DayAvailability> {
  return requestJson(`${ownerUrl(ownerEmail)}/availability/${date}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intervals }),
  })
}

/** The owner's slot ladder for the whole window, flat and ordered by start. */
export function listSlots(
  ownerEmail: string,
  duration: MeetingDuration,
): Promise<Slot[]> {
  return requestJson(`${ownerUrl(ownerEmail)}/slots?duration=${duration}`)
}

/** Books a slot; throws ApiValidationError (422), ApiConflictError (409 — taken meanwhile). */
export function createBooking(
  ownerEmail: string,
  body: CreateBookingBody,
): Promise<Booking> {
  return requestJson(`${ownerUrl(ownerEmail)}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** The owner's upcoming meetings (end >= now), ordered by start ascending. */
export function listMeetings(ownerEmail: string): Promise<Meeting[]> {
  return requestJson(`${ownerUrl(ownerEmail)}/meetings`)
}
