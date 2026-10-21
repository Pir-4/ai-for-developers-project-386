// The app's API layer: every request goes through the client SDK generated from
// the contract by @hey-api/openapi-ts (web/src/generated/api, `make generate`).
// This module only turns the SDK's `{ data, error, response }` results into
// typed exceptions the pages already know how to show.
import * as sdk from './generated/api/index.ts'
import type {
  AvailabilityConflictError,
  BlockingMeeting,
  ConflictError,
  CreateBookingBody,
  CreateEventTypeBody,
  ValidationError,
} from './generated/api/index.ts'

export type {
  AvailabilityConflictError,
  BlockingMeeting,
  Booking,
  CreateBookingBody,
  CreateEventTypeBody,
  DayAvailability,
  EventType,
  Interval,
  Meeting,
  Slot,
  ValidationError,
} from './generated/api/index.ts'

/** The durations the owner may pick for an event type, in the order they are offered. */
export const EVENT_TYPE_DURATIONS = [15, 30, 45, 60, 90, 120]

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

/** 404 from the API — e.g. an event type that does not exist. */
export class ApiNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiNotFoundError'
  }
}

type SdkResult<T> = { data?: T; error?: unknown; response?: Response }

async function unwrap<T>(pending: Promise<SdkResult<T>>): Promise<T> {
  const { data, error, response } = await pending
  if (response?.ok) return data as T
  if (!response) throw error instanceof Error ? error : new Error('request failed')

  if (response.status === 422) {
    throw new ApiValidationError(error as ValidationError)
  }
  if (response.status === 409) {
    const body = error as ConflictError | AvailabilityConflictError
    if ('meetings' in body) throw new ApiAvailabilityConflictError(body)
    throw new ApiConflictError(body.message)
  }
  if (response.status === 404) {
    throw new ApiNotFoundError((error as { message?: string } | undefined)?.message ?? 'not found')
  }
  throw new Error(`${response.status} ${response.statusText}`)
}

/** The owner's availability across the booking window, oldest date first. */
export function listAvailability(ownerEmail: string) {
  return unwrap(sdk.listAvailability({ path: { ownerEmail } }))
}

/**
 * Replaces one date's availability wholesale; an empty list closes the day.
 * Throws ApiValidationError (422) or ApiAvailabilityConflictError (409 — a
 * booking would be left uncovered).
 */
export function setAvailability(
  ownerEmail: string,
  date: string,
  intervals: sdk.Interval[],
) {
  return unwrap(
    sdk.setAvailability({ path: { ownerEmail, date }, body: { intervals } }),
  )
}

/** The owner's event types, oldest first. */
export function listEventTypes(ownerEmail: string) {
  return unwrap(sdk.listEventTypes({ path: { ownerEmail } }))
}

/** One event type of the owner; throws ApiNotFoundError (404). */
export function getEventType(ownerEmail: string, eventTypeId: number) {
  return unwrap(sdk.getEventType({ path: { ownerEmail, eventTypeId } }))
}

/** Creates an event type; throws ApiValidationError (422). */
export function createEventType(ownerEmail: string, body: CreateEventTypeBody) {
  return unwrap(sdk.createEventType({ path: { ownerEmail }, body }))
}

/** The event type's slot ladder for the whole window, flat and ordered by start. */
export function listSlots(ownerEmail: string, eventTypeId: number) {
  return unwrap(sdk.listSlots({ path: { ownerEmail, eventTypeId } }))
}

/**
 * Books a slot of the event type; throws ApiValidationError (422),
 * ApiConflictError (409 — taken meanwhile), ApiNotFoundError (404).
 */
export function createBooking(
  ownerEmail: string,
  eventTypeId: number,
  body: CreateBookingBody,
) {
  return unwrap(sdk.createBooking({ path: { ownerEmail, eventTypeId }, body }))
}

/** The owner's upcoming meetings (end >= now), ordered by start ascending. */
export function listMeetings(ownerEmail: string) {
  return unwrap(sdk.listMeetings({ path: { ownerEmail } }))
}
