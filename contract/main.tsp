import "@typespec/http";
import "@typespec/json-schema";
import "@typespec/versioning";

using TypeSpec.Http;
using TypeSpec.JsonSchema;
using TypeSpec.Versioning;

@service(#{
  title: "Call Booking API",
})
// A single version keeps the required OpenAPI `info.version` honest ("1.0.0" instead of the
// "0.0.0" placeholder) without adding version suffixes to the paths.
@versioned(Versions)
namespace CallBooking;

enum Versions {
  v1: "1.0.0",
}

/** Liveness probe response. */
model HealthStatus {
  /** Always `"ok"`. */
  status: "ok";
}

/** Liveness probe. */
@route("/health")
op health(): HealthStatus;

/** One failed validation constraint of a request. */
model FieldError {
  /** Path to the offending property, e.g. `"intervals/0/end"`. */
  path: string;
  /** What is wrong with it, e.g. `"must be after start"`. */
  message: string;
}

/** The request failed validation. */
model ValidationError {
  /** Human-readable summary. */
  message: string;
  /** One entry per failed constraint. */
  errors: FieldError[];
}

/** 422 — the request failed validation. */
model UnprocessableEntityResponse is Response<422> {
  @body body: ValidationError;
}

/** The referenced resource does not exist. */
model NotFoundError {
  /** Human-readable summary. */
  message: string;
}

/** 404 — the referenced resource does not exist. */
model NotFoundResponse is Response<404> {
  @body body: NotFoundError;
}

/**
 * One continuous stretch of an owner's availability, as UTC instants.
 *
 * The owner's browser converts the hours it displays into UTC; the server stores
 * what it receives verbatim and performs no timezone expansion. See
 * `docs/research/local-time-to-utc.md`.
 */
model Interval {
  /** Start of the stretch, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the stretch, UTC ISO 8601; strictly after `start`. */
  end: utcDateTime;
}

/** The intervals an owner has declared for one date. An empty list closes the day. */
model DayAvailability {
  /**
   * The owner's local calendar date the intervals were entered against, `YYYY-MM-DD`.
   * The server treats it as an opaque grouping key and derives nothing from it.
   */
  date: plainDate;
  /** The declared intervals, ordered by start. */
  intervals: Interval[];
}

/** Body for replacing one date's availability. */
model SetAvailabilityBody {
  /** The full interval set for the date; an empty list closes the day. */
  intervals: Interval[];
}

/** One of the owner's meetings that blocks an availability change. */
model BlockingMeeting {
  /** Start of the meeting, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the meeting, UTC ISO 8601. */
  end: utcDateTime;
  /** The guest's name, so the owner can tell which commitment holds the day. */
  guestName: string;
}

/** Availability may not be withdrawn from under an existing booking. */
model AvailabilityConflictError {
  /** Human-readable summary. */
  message: string;
  /** The meetings the new interval set would no longer cover. */
  meetings: BlockingMeeting[];
}

/** 409 — the new interval set would uncover an existing booking. */
model AvailabilityConflictResponse is Response<409> {
  @body body: AvailabilityConflictError;
}

/** 200 — the stored availability for the date. */
model DayAvailabilityResponse is Response<200> {
  @body body: DayAvailability;
}

/** Replace the owner's availability for one date. */
@route("/owners/{ownerEmail}/availability/{date}")
@put
op setAvailability(
  @path ownerEmail: string,
  @path date: plainDate,
  @body body: SetAvailabilityBody,
):
  | DayAvailabilityResponse
  | UnprocessableEntityResponse
  | AvailabilityConflictResponse;

/** List the owner's availability for the booking window, oldest date first. */
@route("/owners/{ownerEmail}/availability")
@get
op listAvailability(@path ownerEmail: string): DayAvailability[];

/**
 * Meeting length in minutes — the fixed set a guest may choose from.
 *
 * An enum rather than `@multipleOf`/`@minValue`/`@maxValue`: those do not reach
 * a query parameter's schema in the emitted OpenAPI, so 20 would slip past
 * request validation.
 */
enum MeetingDuration {
  quarterHour: 15,
  halfHour: 30,
  threeQuarters: 45,
}

/** Whether a slot can still be booked. */
union SlotStatus {
  /** Nothing of the owner's overlaps it. */
  free: "free",

  /** It intersects one of the owner's bookings. */
  busy: "busy",
}

/** One rung of the slot ladder: a candidate meeting of the requested duration. */
model Slot {
  /** Start of the slot, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the slot, UTC ISO 8601 (`start` + the requested duration). */
  end: utcDateTime;
  /** Whether it is still bookable. */
  status: SlotStatus;
}

/**
 * The owner's slot ladder for the whole booking window, ordered by start.
 *
 * Cells are laid end to end from the start of each availability interval, each
 * exactly `duration` minutes long; a trailing remainder that does not fit is
 * dropped, and cells never span two intervals. Cells that have already started
 * are omitted entirely. The response is deliberately flat: the guest's browser
 * groups it into the guest's own local dates.
 */
@route("/owners/{ownerEmail}/slots")
@get
op listSlots(
  @path ownerEmail: string,

  /** Meeting length in minutes. */
  @query duration: MeetingDuration,
): Slot[];

/** A reservation of a slot, holding the guest's name and email. */
model Booking {
  /** Server-assigned identifier. */
  id: int32;
  /** Email of the owner this booking belongs to. */
  ownerEmail: string;
  /** Start of the booked interval, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the booked interval, UTC ISO 8601 (`start` + `durationMinutes`). */
  end: utcDateTime;
  /** Meeting length in minutes: 15, 30 or 45. */
  durationMinutes: int32;
  /** The guest's name. */
  guestName: string;
  /** The guest's email. */
  guestEmail: string;
  /** When the booking was created, UTC ISO 8601. */
  createdAt: utcDateTime;
}

/** Body for booking a slot. */
model CreateBookingBody {
  /** The guest's name (trimmed server-side to 1–100 characters; raw length is not itself validated). */
  guestName: string;
  /** The guest's email. */
  @pattern("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
  guestEmail: string;
  /** The slot's start time, UTC ISO 8601: must be a free rung of the owner's ladder for this duration. */
  start: utcDateTime;
  /** Meeting length in minutes. */
  durationMinutes: MeetingDuration;
}

/** 201 — the created booking. */
model CreatedBookingResponse is Response<201> {
  @body body: Booking;
}

/** The requested slot is no longer free. */
model ConflictError {
  /** Human-readable summary. */
  message: string;
}

/** 409 — the requested slot overlaps an existing booking of the owner. */
model ConflictResponse is Response<409> {
  @body body: ConflictError;
}

/** Book a slot on the owner's calendar. */
@route("/owners/{ownerEmail}/bookings")
@post
op createBooking(
  @path ownerEmail: string,
  @body body: CreateBookingBody,
):
  | CreatedBookingResponse
  | UnprocessableEntityResponse
  | NotFoundResponse
  | ConflictResponse;

/** One of the owner's meetings — the owner-facing view of a booking. */
model Meeting {
  /** Server-assigned identifier of the booking. */
  id: int32;
  /** Email of the owner this meeting belongs to. */
  ownerEmail: string;
  /** Start of the meeting, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the meeting, UTC ISO 8601. */
  end: utcDateTime;
  /** Meeting length in minutes. */
  durationMinutes: int32;
  /** The guest's name. */
  guestName: string;
  /** The guest's email. */
  guestEmail: string;
}

/** List the owner's upcoming meetings (`end >= now`), ordered by start ascending. */
@route("/owners/{ownerEmail}/meetings")
@get
op listMeetings(@path ownerEmail: string): Meeting[];
