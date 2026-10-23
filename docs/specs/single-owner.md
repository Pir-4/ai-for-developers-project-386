# Specification: Single owner, 30-minute slots, 14-day window

- **Stage**: review fixes, round 2 (Hexlet review, 2026-10).
- **Branch / PR**: `fix/review-single-owner-grid`.
- Supersedes the parts of `event-types.md` that concern owner identity, durations and the grid.

## 1. Goal

Bring the app in line with the assignment:

1. There is **one predefined owner**. Nobody logs in or registers, and typing an email no longer
   creates a new owner.
2. The base grid is **30 minutes**. Every slot is 30 minutes long and starts on `:00` or `:30`.
3. The booking window is **exactly 14 days counting today**: today plus the next 13 days.
4. The landing page leads the **guest to booking**. The owner area is a secondary link.

## 2. Model

- **Owner**: a single profile (`name`, `email`) taken from the server config: `OWNER_NAME` and
  `OWNER_EMAIL`, with demo defaults. It is not stored in the database, and no data is keyed by
  owner.
- **Event type**: `id`, `name` (1–100), `description` (1–500), and `durationMinutes`, which is
  always `30`. The owner does not choose a duration.
- **Availability**: per date, a set of intervals whose bounds are UTC instants on the
  **30-minute grid** (ADR 0001 is unchanged).
- **Slot**: a 30-minute cell of the slot ladder. Starts are taken every 30 minutes from the
  start of each availability interval, and a cell must fit inside its interval. A cell is
  `busy` when it overlaps any booking, of any event type.
- **Booking window**: UTC dates `today … today + 13`.
  - The server rejects availability for any other date with 422.
  - It never returns slots that start before now or on/after the start of `today + 14`.
  - The UI calendars enable exactly those 14 days.
  - Known edge: the window is anchored to the server's UTC day. Near midnight, an owner far
    from UTC may find their local today+13 rejected.

## 3. API (TypeSpec `contract/main.tsp`)

All `{ownerEmail}` path segments are removed.

| Operation | Route |
|---|---|
| `getOwner` | `GET /owner` → `Owner { name, email }` |
| `setAvailability` | `PUT /availability/{date}` |
| `listAvailability` | `GET /availability` |
| `createEventType` | `POST /event-types`; body `{ name, description }` |
| `listEventTypes` | `GET /event-types` |
| `getEventType` | `GET /event-types/{eventTypeId}` |
| `listSlots` | `GET /event-types/{eventTypeId}/slots` |
| `createBooking` | `POST /event-types/{eventTypeId}/bookings` |
| `listMeetings` | `GET /meetings` |

`EventType`, `Booking` and `Meeting` lose `ownerEmail`.

## 4. Frontend

- Routes:
  - `/` — landing
  - `/owner` — owner area
  - `/book` — event-type catalog
  - `/book/:eventTypeId` — date and slot
  - `/login` no longer exists.
- Landing CTAs lead to `/book`. The header keeps a link to the owner area.
- The owner's event-type form has a name and a description. The duration is shown as a fixed
  "30 min".
- The interval editor offers times on the 30-minute grid.

## 5. Acceptance

1. `GET /owner` returns the configured profile, and every page shows that name.
2. Availability bounds off the 30-minute grid → 422.
3. Over `10:00–12:00`, a type offers `10:00`, `10:30`, `11:00` and `11:30`, each 30 minutes long.
4. Availability for `today + 13` is accepted. Availability for `today + 14` or yesterday → 422.
   No slot is returned past `today + 13`.
5. A booking of one type makes the same slot busy for every other type, and booking it → 409.
6. Browser scenario:
   - the owner opens `/owner` without logging in
   - creates a type
   - opens availability
   - the guest goes from the landing CTA to `/book` → picks the type, a date and a slot → books
   - the owner sees the meeting.
