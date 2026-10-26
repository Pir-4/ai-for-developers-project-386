# Specification: Single owner, 30-minute grid, 14-day window

- **Stage**: review fixes, round 2 (Hexlet review, 2026-10). Issue: #53 (supersedes #40).
- **Branch / PR**: `fix/review-single-owner-grid`.
- Supersedes the parts of `event-types.md` that concern owner identity, durations and the grid.
- **Round 3** (branch `fix/review-event-type-duration`): the 30-minute grid governs slot
  **starts**, not meeting length. The owner chooses each event type's duration again.

## 1. Goal

Bring the app in line with the assignment:

1. There is **one predefined owner**. Nobody logs in or registers, and typing an email no longer
   creates a new owner.
2. The base grid is **30 minutes**: every slot starts on `:00` or `:30`. A slot lasts as long as
   its event type, and the owner chooses that duration (30, 60, 90 or 120 minutes in the form).
3. The booking window is **exactly 14 days counting today**: today plus the next 13 days.
4. The landing page leads the **guest to booking**. The owner area is a secondary link.

## 2. Model

- **Owner**: a single profile (`name`, `email`) taken from the server config: `OWNER_NAME` and
  `OWNER_EMAIL`, with demo defaults. It is not stored in the database, and no data is keyed by
  owner.
- **Event type**: `id`, `name` (1–100), `description` (1–500), and `durationMinutes`, chosen by
  the owner: a multiple of 30, from 30 to 240. The form offers 30, 60, 90 and 120.
- **Availability**: per date, a set of intervals whose bounds are UTC instants on the
  **30-minute grid** (ADR 0001 is unchanged).
- **Slot**: a cell of the slot ladder, as long as its event type. Starts are taken every
  30 minutes from the start of each availability interval, and a cell must fit inside its
  interval: a 60-minute type over 10:00–12:00 offers 10:00, 10:30 and 11:00. A cell is
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
| `createEventType` | `POST /event-types`; body `{ name, description, durationMinutes }` (multiple of 30, 30–240, else 422) |
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
- The owner's event-type form has a name, a description and a duration select (30, 60, 90,
  120 minutes; 30 by default).
- The interval editor offers times on the 30-minute grid.

## 5. Acceptance

1. `GET /owner` returns the configured profile, and every page shows that name.
2. Availability bounds off the 30-minute grid → 422.
3. Over `10:00–12:00`, a 30-minute type offers `10:00`, `10:30`, `11:00` and `11:30`; a
   60-minute type offers `10:00`, `10:30` and `11:00`, each 60 minutes long.
   `durationMinutes` that is not a multiple of 30, below 30 or above 240 → 422.
4. Availability for `today + 13` is accepted. Availability for `today + 14` or yesterday → 422.
   No slot is returned past `today + 13`.
5. A booking of one type makes every overlapping slot busy for every other type, and booking it
   → 409: a 60-minute booking at 10:00 makes the 30-minute 10:00 and 10:30 slots busy.
6. Browser scenario:
   - the owner opens `/owner` without logging in
   - creates a 60-minute and a 30-minute type
   - opens availability
   - the guest goes from the landing CTA to `/book` → picks the type, a date and a slot → books
   - the owner sees the meeting with its duration
   - the overlapping slots are shown as taken for both types.
