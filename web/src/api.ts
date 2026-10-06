import type { components } from './generated/schema.js'

export type EventType = components['schemas']['EventType']
export type CreateEventTypeBody = components['schemas']['CreateEventTypeBody']
export type ValidationError = components['schemas']['ValidationError']
export type Booking = components['schemas']['Booking']
export type CreateBookingBody = components['schemas']['CreateBookingBody']
export type Meeting = components['schemas']['Meeting']

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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    if (response.status === 422) {
      throw new ApiValidationError((await response.json()) as ValidationError)
    }
    if (response.status === 409) {
      const body = (await response.json()) as { message: string }
      throw new ApiConflictError(body.message)
    }
    throw new Error(`${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

function eventTypesUrl(ownerEmail: string): string {
  return `/api/owners/${encodeURIComponent(ownerEmail)}/event-types`
}

/** The owner's event types, oldest first. */
export function listEventTypes(ownerEmail: string): Promise<EventType[]> {
  return requestJson(eventTypesUrl(ownerEmail))
}

/** Creates an event type; throws ApiValidationError on 422. */
export function createEventType(
  ownerEmail: string,
  body: CreateEventTypeBody,
): Promise<EventType> {
  return requestJson(eventTypesUrl(ownerEmail), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Free slot start times (UTC ISO 8601) for the event type's booking window. */
export function listSlots(
  ownerEmail: string,
  eventTypeId: number,
): Promise<string[]> {
  return requestJson(
    `${eventTypesUrl(ownerEmail)}/${eventTypeId}/slots`,
  )
}

/** Books a slot; throws ApiValidationError (422), ApiConflictError (409 — taken meanwhile). */
export function createBooking(
  ownerEmail: string,
  eventTypeId: number,
  body: CreateBookingBody,
): Promise<Booking> {
  return requestJson(`${eventTypesUrl(ownerEmail)}/${eventTypeId}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** The owner's upcoming meetings (end >= now), ordered by start ascending. */
export function listMeetings(ownerEmail: string): Promise<Meeting[]> {
  return requestJson(
    `/api/owners/${encodeURIComponent(ownerEmail)}/meetings`,
  )
}
