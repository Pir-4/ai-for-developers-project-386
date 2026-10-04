# Call Booking

A simplified Cal.com: one predefined owner publishes bookable event types; guests book slots without accounts.

## Language

**Owner**:
The single predefined profile that administers the calendar: creates event types and views upcoming meetings. No account, no login.
_Avoid_: admin, user, host

**Guest**:
An anonymous visitor who books a slot, identified per booking by name and email.
_Avoid_: user, customer, invitee

**Event type**:
A kind of bookable meeting defined by the owner: name, description and duration in minutes (a multiple of 15, from 15 to 240). Its id is assigned by the system.
_Avoid_: slot type, event kind

**Slot**:
A candidate start time offered to a guest, taken from a fixed 30-minute grid (starts at :00 and :30, around the clock); a slot's length equals the chosen event type's duration.
_Avoid_: time slot, availability

**Booking**:
A reservation of a slot for a chosen event type, holding the guest's name and email. A booking occupies its interval exclusively across all event types: no other booking may overlap it.
_Avoid_: reservation, appointment

**Booking window**:
The 14-day period, starting from the current date, within which a guest can pick a slot; booking into the past is not allowed.
_Avoid_: availability window, horizon
