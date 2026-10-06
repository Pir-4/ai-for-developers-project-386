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

/** A kind of bookable meeting defined by an owner: name, description and duration. */
model EventType {
  /** Server-assigned identifier. */
  id: int32;
  /** Email of the owner this event type belongs to. */
  ownerEmail: string;
  /** Short display name shown to the owner and the guest. */
  name: string;
  /** What the meeting is about, shown to the guest. */
  description: string;
  /** Meeting length in minutes. */
  duration: int32;
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
  /** Meeting length in minutes: a multiple of 15, from 15 to 240. */
  @multipleOf(15)
  @minValue(15)
  @maxValue(240)
  duration: int32;
}

/** One failed validation constraint of a request. */
model FieldError {
  /** Path to the offending property, e.g. `"duration"`. */
  path: string;
  /** What is wrong with it, e.g. `"must be multiple of 15"`. */
  message: string;
}

/** The request failed validation. */
model ValidationError {
  /** Human-readable summary. */
  message: string;
  /** One entry per failed constraint. */
  errors: FieldError[];
}

/** 201 — the created event type. */
model CreatedEventTypeResponse is Response<201> {
  @body body: EventType;
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

/** The requested interval is already booked. */
model ConflictError {
  /** Human-readable summary. */
  message: string;
}

/** 409 — the requested interval overlaps an existing booking of the owner. */
model ConflictResponse is Response<409> {
  @body body: ConflictError;
}

/** A reservation of a slot for an event type, holding the guest's name and email. */
model Booking {
  /** Server-assigned identifier. */
  id: int32;
  /** The event type this booking is for. */
  eventTypeId: int32;
  /** Email of the owner this booking belongs to. */
  ownerEmail: string;
  /** Start of the booked interval, UTC ISO 8601. */
  start: utcDateTime;
  /** End of the booked interval, UTC ISO 8601 (start + the event type's duration). */
  end: utcDateTime;
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
  /** The slot's start time, UTC ISO 8601: must fall on the :00/:30 grid, not be in the past, and lie within the booking window. */
  start: utcDateTime;
}

/** 201 — the created booking. */
model CreatedBookingResponse is Response<201> {
  @body body: Booking;
}

/** Create an event type for the owner. */
@route("/owners/{ownerEmail}/event-types")
@post
op createEventType(
  @path ownerEmail: string,
  @body body: CreateEventTypeBody,
): CreatedEventTypeResponse | UnprocessableEntityResponse;

/** List the owner's event types, oldest first. */
@route("/owners/{ownerEmail}/event-types")
@get
op listEventTypes(@path ownerEmail: string): EventType[];

/**
 * Free slot start times for this event type, UTC ISO 8601, on the 30-minute
 * grid (`:00`/`:30`), bounded to the booking window and excluding the
 * owner's booked intervals.
 */
@route("/owners/{ownerEmail}/event-types/{id}/slots")
@get
op listSlots(
  @path ownerEmail: string,
  @path id: int32,
): utcDateTime[] | NotFoundResponse;

/** Book a slot for the event type. */
@route("/owners/{ownerEmail}/event-types/{id}/bookings")
@post
op createBooking(
  @path ownerEmail: string,
  @path id: int32,
  @body body: CreateBookingBody,
):
  | CreatedBookingResponse
  | UnprocessableEntityResponse
  | NotFoundResponse
  | ConflictResponse;
