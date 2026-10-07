# Call Booking

A simplified Cal.com: owners identified by email alone declare availability on their calendar and share a single link to it; guests choose a duration and book a slot without accounts.

## Language

**Owner**:
A calendar owner identified solely by an email address — no password, no registration: the email is the key. Multiple owners coexist, each with their own availability and upcoming meetings.
_Avoid_: admin, user, account, profile

**Guest**:
An anonymous visitor who arrives via an owner's link and books a slot, identified per booking by name and email.
_Avoid_: user, customer, invitee

**Availability**:
The intervals an owner has declared for one date on their calendar; a date with no intervals is closed. Replacing a date's availability replaces the whole set, never merges into it.
_Avoid_: hours, schedule, calendar

**Interval**:
One continuous stretch of an owner's availability on one date, its bounds on the 15-minute grid and stored as UTC instants — the owner's browser converts its local wall time to UTC before sending; the server performs no timezone expansion and stores no offset.
_Avoid_: time range, window, block

**Slot ladder**:
The sequence of candidate slots produced for one availability interval and a chosen duration: cells laid end to end from the interval's start, each cell exactly that duration long; a trailing remainder that does not fit is dropped, and a ladder never spans two intervals.
_Avoid_: schedule, timetable

**Slot**:
One rung of a slot ladder: a candidate start time for a meeting of the guest's chosen duration (15, 30 or 45 minutes), carrying a status of free or busy. No longer a point on a fixed grid — its length and position follow from the owner's declared intervals.
_Avoid_: time slot, availability

**Booking**:
A reservation of a slot, holding the guest's name, email and the meeting's duration in minutes (15, 30 or 45) rather than an event type. A booking occupies its interval exclusively across all of the same owner's bookings: no other booking of that owner may overlap it.
_Avoid_: reservation, appointment

**Meeting**:
The owner-facing label for a booking — what the owner's upcoming-meetings list shows, including its duration.
_Avoid_: appointment, call

**Booking window**:
The 14-day period, starting from the current date, within which a guest can pick a slot; booking into the past is not allowed.
_Avoid_: availability window, horizon
