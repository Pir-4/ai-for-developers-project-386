# Call Booking

A simplified Cal.com: owners identified by email alone publish bookable event types and share links to them; guests book slots without accounts.

## Language

**Owner**:
A calendar owner identified solely by an email address — no password, no registration: the email is the key. Multiple owners coexist, each with their own event types and upcoming meetings.
_Avoid_: admin, user, account, profile

**Guest**:
An anonymous visitor who arrives via an owner's link and books a slot, identified per booking by name and email.
_Avoid_: user, customer, invitee

**Event type**:
A kind of bookable meeting defined by an owner: name, description and duration in minutes (a multiple of 15, from 15 to 240). Its id is assigned by the system; it belongs to exactly one owner.
_Avoid_: slot type, event kind

**Slot**:
A candidate start time offered to a guest, taken from a fixed 30-minute grid (starts at :00 and :30, around the clock); a slot's length equals the chosen event type's duration.
_Avoid_: time slot, availability

**Booking**:
A reservation of a slot for a chosen event type, holding the guest's name and email. A booking occupies its interval exclusively across all event types of the same owner: no other booking of that owner may overlap it.
_Avoid_: reservation, appointment

**Meeting**:
The owner-facing label for a booking — what the owner's upcoming-meetings page lists.
_Avoid_: appointment, call

**Booking window**:
The 14-day period, starting from the current date, within which a guest can pick a slot; booking into the past is not allowed.
_Avoid_: availability window, horizon
