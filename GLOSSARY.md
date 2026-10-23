# Call Booking

A simplified Cal.com: a single predefined owner defines event types, declares availability on their calendar and shares a link; guests pick an event type, then a date and a free 30-minute slot, and book it without accounts.

## Language

**Owner**:
The one calendar owner the app serves: a profile (name, email) predefined in the server config (`OWNER_NAME`, `OWNER_EMAIL`), not stored in the database. There is no login, no registration and no second owner; the owner area is open at `/owner`.
_Avoid_: admin, user, account, profile

**Guest**:
An anonymous visitor who arrives via an owner's link and books a slot, identified per booking by name and email.
_Avoid_: user, customer, invitee

**Event type**:
A kind of bookable meeting the owner defines: a name and a description. Every event type lasts 30 minutes — the owner does not choose a duration. A guest always books a slot of a specific event type.
_Avoid_: service, product, meeting kind

**Availability**:
The intervals an owner has declared for one date on their calendar; a date with no intervals is closed. Replacing a date's availability replaces the whole set, never merges into it.
_Avoid_: hours, schedule, calendar

**Interval**:
One continuous stretch of an owner's availability on one date, its bounds on the 30-minute grid and stored as UTC instants — the owner's browser converts its local wall time to UTC before sending; the server performs no timezone expansion and stores no offset.
_Avoid_: time range, window, block

**Slot ladder**:
The sequence of candidate slots produced for one availability interval: a 30-minute cell starting at every step of the 30-minute grid from the interval's start, each cell fully inside the interval; a ladder never spans two intervals.
_Avoid_: schedule, timetable

**Slot**:
One rung of a slot ladder: a 30-minute candidate meeting starting on `:00` or `:30`, carrying a status of free or busy — busy when it overlaps any booking, whatever its event type.
_Avoid_: time slot, availability

**Booking**:
A reservation of a slot of one event type, holding the guest's name, email and the type's duration in minutes at booking time. A booking occupies its interval exclusively across all bookings, of every event type: no other booking may overlap it.
_Avoid_: reservation, appointment

**Meeting**:
The owner-facing label for a booking — what the owner's upcoming-meetings list shows, including its event type's name and duration.
_Avoid_: appointment, call

**Booking window**:
Exactly 14 days counting today — today and the next 13 days (UTC dates on the server) — within which the owner declares availability and a guest can pick a slot; booking into the past is not allowed.
_Avoid_: availability window, horizon
