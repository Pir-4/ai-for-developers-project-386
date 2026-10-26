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

/** The calendar owner: a single predefined profile from the server config. */
model Owner {
  /** Display name shown to guests. */
  name: string;
  /** Contact email. */
  email: string;
}

/** The predefined owner whose calendar this app serves. */
@route("/owner")
@get
op getOwner(): Owner;

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
 * One continuous stretch of an owner's availability, as UTC instants. Both bounds
 * lie on the 30-minute grid.
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
   * Must fall within the booking window: today … today + 13 (UTC), 14 days in all.
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
@route("/availability/{date}")
@put
op setAvailability(
  @path date: plainDate,
  @body body: SetAvailabilityBody,
):
  | DayAvailabilityResponse
  | UnprocessableEntityResponse
  | AvailabilityConflictResponse;

/** List the owner's availability for the booking window, oldest date first. */
@route("/availability")
@get
op listAvailability(): DayAvailability[];

/** A kind of bookable meeting defined by the owner: name, description and duration. */
model EventType {
  /** Server-assigned identifier. */
  id: int32;
  /** Short display name shown to the owner and the guest. */
  name: string;
  /** What the meeting is about, shown to the guest. */
  description: string;
  /** Meeting length in minutes, chosen by the owner — every slot of this type is exactly this long. */
  durationMinutes: int32;
}

/** Body for creating an event type. */
model CreateEventTypeBody {
  /** Short display name shown to the owner and the guest. */
  @minLength(1)
  @maxLength(100)
  name: string;
  /** What the meeting is about, shown to the guest. */
  @minLength(1)
  @maxLength(500)
  description: string;
  /**
   * Meeting length in minutes: a multiple of 30, from 30 to 240. Slots of any length
   * start on the 30-minute grid, so a 60-minute meeting may start at 10:00 or 10:30.
   */
  @multipleOf(30)
  @minValue(30)
  @maxValue(240)
  durationMinutes: int32;
}

/** 201 — the created event type. */
model CreatedEventTypeResponse is Response<201> {
  @body body: EventType;
}

/** Create an event type for the owner. */
@route("/event-types")
@post
op createEventType(@body body: CreateEventTypeBody): CreatedEventTypeResponse | UnprocessableEntityResponse;

/** List the owner's event types, oldest first. */
@route("/event-types")
@get
op listEventTypes(): EventType[];

/** One of the owner's event types. */
@route("/event-types/{eventTypeId}")
@get
op getEventType(@path eventTypeId: int32): EventType | NotFoundResponse;

/** Whether a slot can still be booked. */
union SlotStatus {
  /** Nothing of the owner's overlaps it. */
  free: "free",

  /** It intersects one of the owner's bookings, of any event type. */
  busy: "busy",
}

/** One rung of the slot ladder: a candidate meeting of the event type's duration. */
model Slot {
  /** Start of the slot, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the slot, UTC ISO 8601 (`start` + the event type's duration). */
  end: utcDateTime;
  /** Whether it is still bookable. */
  status: SlotStatus;
}

/**
 * The event type's slot ladder for the whole booking window, ordered by start.
 *
 * Cells start every 30 minutes from the start of each availability interval, each
 * exactly the event type's duration long and fully inside its
 * interval. Cells that have already started, and cells starting after the last day
 * of the booking window (today + 13, UTC), are omitted entirely. A cell is busy
 * when it overlaps any booking of the owner, whatever its event type. The response
 * is deliberately flat: the guest's browser groups it into the guest's own local dates.
 */
@route("/event-types/{eventTypeId}/slots")
@get
op listSlots(@path eventTypeId: int32): Slot[] | NotFoundResponse;

/** A reservation of a slot of an event type, holding the guest's name and email. */
model Booking {
  /** Server-assigned identifier. */
  id: int32;
  /** The event type this booking is for. */
  eventTypeId: int32;
  /** Start of the booked interval, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the booked interval, UTC ISO 8601 (`start` + `durationMinutes`). */
  end: utcDateTime;
  /** Meeting length in minutes, taken from the event type at booking time. */
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
  /** The slot's start time, UTC ISO 8601: must be a free rung of the event type's ladder. */
  start: utcDateTime;
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

/** Book a slot of the event type on the owner's calendar. */
@route("/event-types/{eventTypeId}/bookings")
@post
op createBooking(
  @path eventTypeId: int32,
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
  /** The event type this meeting is for. */
  eventTypeId: int32;
  /** Name of the event type, shown in the row. */
  eventTypeName: string;
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
@route("/meetings")
@get
op listMeetings(): Meeting[];
