# API Contract — "Call Booking"

This is the source of truth for the client and the server. Any change to API behavior
is recorded here first, then implemented in the code.

## General rules

- All dates and times — UTC in ISO 8601 format (`2026-09-26T10:00:00Z`).
- A slot is exactly 30 minutes; `start` is aligned to `:00` or `:30`.
- No authentication: owner and guest endpoints are public.
- Validation errors — 422, business errors — JSON `{"detail": "..."}`.

## Slots

### `POST /api/slots` — publish a slot (owner)

Request:

```json
{ "start": "2026-09-27T10:00:00Z" }
```

- 201 → `{ "id": 1, "start": "...", "end": "...30 minutes later...", "available": true }`
- 409 — a slot with this `start` already exists
- 422 — `start` is not aligned to 30 minutes

### `GET /api/slots?date=YYYY-MM-DD` — list slots for a date (guest)

`date` is optional, defaults to today (UTC).

200 →

```json
{
  "slots": [
    { "id": 1, "start": "...", "end": "...", "available": true },
    { "id": 2, "start": "...", "end": "...", "available": false }
  ]
}
```

`available: false` — the slot is already booked. Sorted by `start` ascending.

## Bookings

### `POST /api/bookings` — book a call (guest)

Request:

```json
{ "slot_id": 1, "name": "John", "comment": "let's talk about the project" }
```

`comment` is optional.

- 201 → `{ "id": 1, "start": "...", "end": "...", "name": "John", "comment": "..." }`
- 404 — no slot with this `slot_id`
- 409 — the slot is already booked
- 422 — empty `name`

### `GET /api/bookings` — upcoming meetings (owner)

200 →

```json
{
  "bookings": [
    { "id": 1, "start": "...", "end": "...", "name": "John", "comment": "..." }
  ]
}
```

Only future meetings (`start >= now`), sorted by `start` ascending.

## Maintenance

### `GET /api/health` → 200 `{"status": "ok"}`
