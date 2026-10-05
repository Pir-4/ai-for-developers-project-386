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
