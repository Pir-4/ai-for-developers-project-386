# Availability intervals travel as UTC instants, not owner-local HH:MM + offset

The original design for the owner-availability feature (spec #40) had the owner's browser send
`{date, start: "HH:MM", end: "HH:MM"}` plus an offset, and the server expand that to UTC instants.
Research (`docs/research/local-time-to-utc.md`, issue #36) showed a single offset captured at "now"
is wrong by the full DST transition size — 60 minutes in most zones, 30 in `Australia/Lord_Howe` —
for every date in the 14-day window on or after a transition (568–756 of 1440 grid cells in an
affected window; a transition falls inside the window roughly 8.2% of the year). A per-date offset
fixes most of that but still misses the 8–12 cells that fall inside the transition date itself.

We decided instead that **the owner's browser converts local wall time to UTC itself**, using the
same `Date` arithmetic already available to it, and sends fully-formed UTC instants
(`utcDateTime` in the contract). The server stores and returns them verbatim: no timezone
expansion, no IANA zone stored anywhere. This is correct by construction — the browser that knows
the owner's zone does the one conversion that needs it — and it deletes server-side expansion code
instead of adding more of it.

## Considered Options

- **Single offset at "now"** — wrong past any DST boundary in the window, as above. Rejected.
- **Per-date offset** (`getTimezoneOffset()` evaluated per date) — correct except on the transition
  date itself, where the local wall time can be ambiguous (fall-back) or not exist at all
  (spring-forward). Rejected as still wrong on exactly the dates where it matters most.
- **Client sends UTC instants directly** (chosen) — correct by construction; the browser already
  disambiguates the spring-forward gap and fall-back duplicate via `Intl`/`Date` the same way a
  server-side `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'longOffset' })` would, without the
  project taking on a timezone library or storing an IANA zone.

## Consequences

- No IANA zone is ever stored; the server cannot recompute an interval in a different zone later.
  If the product ever needs to re-derive the owner's local hours from stored data (e.g. a weekly
  recurring-hours feature), the zone would have to be captured separately at that point.
- Because a local wall-time interval can collapse to zero length across a spring-forward gap, the
  server still validates `start < end` on the instants it receives, and rejects overlapping
  intervals for the same date — the one piece of server-side validation this decision does not
  remove.

## Addendum (2026-10-23): strict 14-day window on the 30-minute grid

Interval bounds now lie on the 30-minute grid, and the booking window is exactly 14 days counting
today. The server still stores no zone, so it anchors the window to UTC dates: a date key is
accepted only for today … today + 13 (UTC), and no slot starting on or after the start of
today + 14 (UTC) is offered. The browsers enable the same 14 local days. Near midnight, an owner
far from UTC may find their local edge day rejected. We accept that edge rather than store a zone
(`docs/specs/single-owner.md`). The grid fixes where slots start, not how long they last: each
event type keeps its own owner-chosen duration (30–240 minutes in steps of 30).
