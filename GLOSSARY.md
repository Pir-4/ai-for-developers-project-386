# Call Booking

A simplified Cal.com: owners identified by email alone define event types, declare availability on their calendar and share a link; guests pick an event type, then a date and a free slot, and book it without accounts.

## Language

**Owner**:
A calendar owner identified solely by an email address — no password, no registration: the email is the key. Multiple owners coexist, each with their own availability and upcoming meetings.
_Avoid_: admin, user, account, profile

**Guest**:
An anonymous visitor who arrives via an owner's link and books a slot, identified per booking by name and email.
_Avoid_: user, customer, invitee

**Event type**:
A kind of bookable meeting an owner defines: a name, a description and a duration in minutes (a multiple of 15, from 15 to 240). A guest always books a slot of a specific event type, and the type's duration is the slot's length.
_Avoid_: service, product, meeting kind

**Availability**:
The intervals an owner has declared for one date on their calendar; a date with no intervals is closed. Replacing a date's availability replaces the whole set, never merges into it.
_Avoid_: hours, schedule, calendar

**Interval**:
One continuous stretch of an owner's availability on one date, its bounds on the 15-minute grid and stored as UTC instants — the owner's browser converts its local wall time to UTC before sending; the server performs no timezone expansion and stores no offset.
_Avoid_: time range, window, block

**Slot ladder**:
The sequence of candidate slots produced for one availability interval and an event type's duration: cells laid end to end from the interval's start, each cell exactly that duration long; a trailing remainder that does not fit is dropped, and a ladder never spans two intervals.
_Avoid_: schedule, timetable

**Slot**:
One rung of a slot ladder: a candidate start time for a meeting of an event type, as long as that type's duration, carrying a status of free or busy — busy when it overlaps any booking of the owner, whatever its event type. No longer a point on a fixed grid — its length and position follow from the owner's declared intervals.
_Avoid_: time slot, availability

**Booking**:
A reservation of a slot of one event type, holding the guest's name, email and the type's duration in minutes at booking time. A booking occupies its interval exclusively across all of the same owner's bookings, of every event type: no other booking of that owner may overlap it.
_Avoid_: reservation, appointment

**Meeting**:
The owner-facing label for a booking — what the owner's upcoming-meetings list shows, including its event type's name and duration.
_Avoid_: appointment, call

**Booking window**:
The 14-day period, starting from the current date, within which a guest can pick a slot; booking into the past is not allowed.
_Avoid_: availability window, horizon
