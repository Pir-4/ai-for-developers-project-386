# Research: expanding owner-local HH:MM to UTC without a timezone library

Resolves GitHub issue #36 (part of the wayfinder map #34, blocks #37).
Date: 2026-10-06. Every empirical claim below was produced by running Node **22.23.3**
(ICU 78.3, tz database 2026c) with a `TZ=` environment variable; the real output is quoted.
Normative claims cite ECMA-262 / ECMA-402 / MDN (see [Sources](#sources)).

## Context and constraints

From the charting decisions of map #34 that this research must respect:

- **Decision 5** — the owner sets hours in their own browser-local timezone, the server stores UTC
  instants, the guest sees them in their own local timezone, the API stays UTC ISO 8601, and
  **no IANA zone is stored**.
- **Decision 7** — `PUT /owners/{email}/availability/{date}` carries `{ intervals: [{ start: "HH:MM", end: "HH:MM" }] }`;
  times travel as owner-local `"HH:MM"` plus the date in the path, and "the server expands them to
  UTC using the offset the client sends".
- **Decision 9** — the window runs over **calendar dates**, today … today + 14 inclusive (15 dates).
- **Decision 2** — interval bounds lie on the **15-minute grid**; several intervals per day are allowed.
- Project-wide: no timezone library, Node 22, TypeScript strict. `Temporal` is **not** available —
  `node -e 'console.log(typeof globalThis.Temporal)'` → `undefined` on 22.23.3.

### The one piece of vocabulary that matters

`Date.prototype.getTimezoneOffset()` returns `(tv - LocalTime(tv)) / msPerMinute` (ECMA-262 §21.4.4.11),
i.e. **minutes to add to local time to get UTC**, *positive west of Greenwich*. MDN: "positive if the
local time zone is behind UTC, and negative if the local time zone is ahead of UTC. For example, for
UTC+10, `-600` will be returned." The sign is the opposite of the ISO 8601 `+02:00` convention, which
is the single most common bug in hand-rolled expansion code. Throughout this document `off` is in
`getTimezoneOffset()` units, so the expansion is

```ts
const instant = new Date(Date.UTC(Y, M - 1, D, hh, mm) + off * 60_000)
```

MDN also states the fact this whole ticket turns on: "In a region that annually shifts in and out of
Daylight Saving Time (DST), as `date` varies, the number of minutes returned by calling
`getTimezoneOffset()` can be non-uniform." The offset is a function of the *instant*, not of the user.

### Reference transitions used below

| Zone | Spring forward (gap) | Fall back (duplicate) | Size |
| --- | --- | --- | --- |
| `Europe/Berlin` | 2026-03-29, 02:00 → 03:00 local | 2026-10-25, 03:00 → 02:00 local | 60 min |
| `America/New_York` | 2026-03-08, 02:00 → 03:00 local | 2026-11-01, 02:00 → 01:00 local | 60 min |
| `Australia/Lord_Howe` | 2026-10-04 | 2026-04-05 | **30 min** (`GMT+10:30` ↔ `GMT+11:00`) |

Local day lengths on those dates, measured with `new Date(Y, M-1, D+1) - new Date(Y, M-1, D)` under
`TZ=Europe/Berlin`:

```
2026-03-29 local day length: 23 h
2026-10-25 local day length: 25 h
2026-06-10 local day length: 24 h
```

---

## Q1 — What breaks with a single offset captured at "now"

**Answer: every date in the window from the transition day onward is off by exactly the size of the
transition — 60 minutes in nearly every zone, 30 minutes in `Australia/Lord_Howe` — and the direction
flips between spring and autumn.**

### Spring forward — stored instants land **one hour late**

Offset captured on 2026-03-20 in Berlin is `-60` (CET). Every date on or after 2026-03-29 is really
`-120` (CEST), so `Date.UTC(...) + (-60)*60000` produces an instant one hour **later** than intended.
The owner typed 10:00; everyone — the owner's own reloaded panel and every guest — sees 11:00.

```
TZ = Europe/Berlin | anchor 2026-03-20 | single offset -60 min
2026-03-28 10:00 -> 2026-03-28T09:00:00.000Z (renders as 28/03/2026, 10:00) | correct 2026-03-28T09:00:00.000Z | drift +0
2026-03-29 10:00 -> 2026-03-29T09:00:00.000Z (renders as 29/03/2026, 11:00) | correct 2026-03-29T08:00:00.000Z | drift +60
2026-03-30 10:00 -> 2026-03-30T09:00:00.000Z (renders as 30/03/2026, 11:00) | correct 2026-03-30T08:00:00.000Z | drift +60
2026-04-03 10:00 -> 2026-04-03T09:00:00.000Z (renders as 03/04/2026, 11:00) | correct 2026-04-03T08:00:00.000Z | drift +60
```

Same shape in `America/New_York` (anchor 2026-03-02, single offset `300`): drift `+60` from 2026-03-08 on.

### Fall back — stored instants land **one hour early**

Offset captured on 2026-10-20 in Berlin is `-120` (CEST). Every date on or after 2026-10-25 is really
`-60` (CET), so the instant comes out one hour **earlier** than intended. The owner typed 10:00,
everyone sees 09:00.

```
TZ = Europe/Berlin | anchor 2026-10-20 | single offset -120 min
2026-10-24 10:00 -> 2026-10-24T08:00:00.000Z (renders as 24/10/2026, 10:00) | correct 2026-10-24T08:00:00.000Z | drift +0
2026-10-25 10:00 -> 2026-10-25T08:00:00.000Z (renders as 25/10/2026, 09:00) | correct 2026-10-25T09:00:00.000Z | drift -60
2026-11-02 10:00 -> 2026-11-02T08:00:00.000Z (renders as 02/11/2026, 09:00) | correct 2026-11-02T09:00:00.000Z | drift -60
```

`America/New_York` (anchor 2026-10-20, single offset `240`): drift `-60` from 2026-11-01 on.

### Summary of the failure

| Transition | Offset captured | Dates after the transition | Stored instant | Owner/guest sees |
| --- | --- | --- | --- | --- |
| Spring forward | standard time (e.g. `-60` CET) | are DST (`-120` CEST) | **+60 min too late** | 10:00 → **11:00** |
| Fall back | DST (e.g. `-120` CEST) | are standard (`-60` CET) | **−60 min too early** | 10:00 → **09:00** |

The error is **not** confined to the transition day: it applies to the whole tail of the window,
because one captured offset is wrong for every date that sits on the other side of the line.

### How much of the window, how often

Exhaustive round trip (owner types `HH:MM` → server stores an instant → client renders it back) over a
complete 15-date window on the 15-minute grid, 1440 cases per window, `TZ=Europe/Berlin`:

| Window | Single "now" offset | Per-date offset (noon) | Per-date offset (00:00) | Client-built instant |
| --- | --- | --- | --- | --- |
| 2026-03-20 … 04-03 (spring) | **568 / 1440** wrong | 12 / 1440 | 88 / 1440 | **4 / 1440** |
| 2026-10-18 … 11-01 (autumn) | **756 / 1440** wrong | 8 / 1440 | 84 / 1440 | **0 / 1440** |
| 2026-06-01 … 06-15 (no transition) | 0 / 1440 | 0 / 1440 | 0 / 1440 | 0 / 1440 |

Frequency: the window spans 15 calendar dates, so a given transition falls inside it for 15 consecutive
start days. With two transitions a year that is `30/365 ≈ **8.2 %** of the year` during which the
owner's availability form is silently wrong — in the EU for roughly the two weeks before the last
Sunday of March and the last Sunday of October, i.e. precisely when a user is most likely to notice.

**Side effect on decision 6.** Availability may not be withdrawn from under a booking. A booking stored
with the wrong offset is an hour away from where the owner thinks it is, so the `409` coverage check
starts rejecting edits the owner believes are legal — and, since the project has no cancellation,
the wrong row is permanent.

---

## Q2 — Correct alternatives that still store no IANA zone

Three candidates, all compatible with decision 5 (no IANA zone anywhere).

### Option A — per-date offset, one per date in the window

`PUT .../availability/{date}` gains `offsetMinutes`, computed by the client as
`new Date(Y, M-1, D, 12, 0).getTimezoneOffset()` for *that* date.

- Fixes the Q1 failure completely: 12 / 1440 and 8 / 1440 in the tables above, down from 568 / 756.
- But it is **not correct** — one offset cannot describe a transition day, which has two. The residual
  errors are exactly the wall times on the wrong side of noon on the transition date itself:

```
-- per-date offset evaluated at local noon --
2026-03-29 00:00 -> 2026-03-28T22:00:00.000Z -> renders 2026-03-28 23:00   (wrong day!)
2026-10-25 00:00 -> 2026-10-24T23:00:00.000Z -> renders 2026-10-25 01:00
```

  Anchoring the probe at local `00:00` instead of noon just moves the damage to the other,
  larger half of the day (88 / 84 cases).
- It also doubles the payload semantics of a single-day `PUT` for no gain, and `GET .../availability`
  (whole window) would have to accept 15 offsets or recompute.

### Option B — per-**time** offset

`off = new Date(Y, M-1, D, hh, mm).getTimezoneOffset()`, sent per interval bound.

This is *almost* exactly right — and that is the point: it is **arithmetically identical to Option C**,
because the client has to construct the local `Date` to read the offset anyway. Verified over 400 days
× 5 times per day in `Europe/Berlin`:

```
differences over 400 days x 5 times: 1
DIFF 2026-03-29T01:30:00.000Z  vs  2026-03-29T00:30:00.000Z
```

The single divergence is the fall-back ambiguous wall time, where the round trip through
`getTimezoneOffset()` lands on the *other* occurrence of the repeated hour — the spec warns about
exactly this (ECMA-262 §21.4.1.25 Note 3: "`LocalTime(UTC(tv_local))` is not necessarily always equal
to `tv_local`"). So Option B is Option C with one extra failure mode and a wider wire format.

### Option C — the client sends the fully-formed UTC instant

The client does `new Date(Y, M-1, D, hh, mm).toISOString()` and the server keeps it verbatim.

- **Correct by construction.** The `Date(year, month, …)` constructor runs ECMA-262 §21.4.1.26 `UTC(t)`,
  which consults the real IANA rules of the browser's zone via `GetNamedTimeZoneEpochNanoseconds` and
  resolves gaps and duplicates per spec. The browser already carries the full tz database; we are
  borrowing it instead of re-deriving it.
- Round trip: **0 / 1440** errors in the autumn window, **4 / 1440** in the spring window — and those
  four are the four 15-minute wall times inside the gap, which *do not exist* and therefore cannot be
  round-tripped by any method (see Q4).
- No offset travels at all, so there is no sign convention to get wrong on the server, and no
  "which offset was meant" ambiguity.
- The server-side handler collapses to `new Date(body.start)` plus a validity check — no arithmetic.

**Cost against the shape decided in decision 7.** The `"HH:MM"` + date-in-the-path shape is the thing
that has to give. Two sub-variants:

| Variant | Wire shape | TypeSpec | Notes |
| --- | --- | --- | --- |
| C1 — UTC instants | `{ start: "2026-10-25T08:00:00Z", end: "2026-10-25T09:00:00Z" }` | `utcDateTime` | Matches decision 5's "API stays UTC ISO 8601" exactly and matches what `Meeting`/`Slot` already use (`contract/main.tsp` lines 119–197). The `{date}` path segment stays as the addressing key; the server validates that each instant falls inside that owner-local date by re-deriving it from the sent instants. |
| C2 — offset-carrying ISO | `{ start: "2026-10-25T10:00:00+02:00", … }` | `offsetDateTime` | Keeps the human-readable wall time *and* the correct offset in one self-describing token; `new Date(str)` parses it (verified: `"2026-10-25T10:00:00+02:00"` → `2026-10-25T08:00:00.000Z`). But `@typespec/openapi3` emits `{type: string, format: date-time}` for **both** `utcDateTime` and `offsetDateTime` (`std-scalar-schemas.js`), so the contract buys no extra validation, and it puts two representations of the same fact on the wire. |

Keeping `"HH:MM"` **and** adding an instant is the worst of both: two sources of truth that can disagree,
with no rule for which wins.

### Verdict on Q2

Option C1 is the only one that is actually correct, and it is also the *smallest* server change —
it deletes the expansion code rather than fixing it. Option A is a real improvement over the status quo
but is still wrong on 8–12 cells of a transition day; Option B is Option C wearing a worse wire format.
See [Recommendation](#recommendation).

---

## Q3 — What Node 22 offers natively for IANA offsets (fallback, not the chosen design)

There is no `getOffset(zone, instant)` in the language. The supported route is `Intl.DateTimeFormat`
with `timeZoneName: 'longOffset'` and `formatToParts()`.

`timeZoneName` accepts `"short" | "long" | "shortOffset" | "longOffset" | "shortGeneric" | "longGeneric"`
(ECMA-402 Table 16, "DateTimeFormat Components"). MDN documents `longOffset` as the "Long localized GMT
format", e.g. `GMT-08:00`, and `shortOffset` as `GMT-8`.

### Exact output shape (verified)

```js
new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'longOffset' })
  .formatToParts(new Date('2026-07-01T12:00:00Z'))
```

```
[{"type":"month","value":"7"},{"type":"literal","value":"/"},{"type":"day","value":"1"},
 {"type":"literal","value":"/"},{"type":"year","value":"2026"},{"type":"literal","value":", "},
 {"type":"timeZoneName","value":"GMT+02:00"}]
```

Winter instant → `GMT+01:00`. `shortOffset` gives `GMT+2` / `GMT+1`. Half- and quarter-hour zones come
out correctly: `Asia/Kolkata` → `GMT+05:30`, `Asia/Kathmandu` → `GMT+05:45`, `Pacific/Chatham` →
`GMT+12:45`, `Australia/Lord_Howe` → `GMT+10:30`, `UTC` → `GMT+00:00`.

### The parser

```ts
// Offset of `timeZone` at `instant`, in getTimezoneOffset() units (positive = behind UTC).
function zoneOffsetMinutes(timeZone: string, instant: Date): number {
  const value = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')!.value // "GMT+02:00" | "GMT-04:00" | "GMT"
  const m = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value)
  return m ? (m[1] === '-' ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}
```

Verified output: `Europe/Berlin` @ `2026-03-29T00:30:00Z` → `-60`; @ `2026-03-29T01:30:00Z` → `-120`;
`America/New_York` @ `2026-11-01T05:30:00Z` → `240`; `Asia/Kathmandu` → `-345`.

### Caveats

1. **It answers the wrong question.** It maps *instant → offset*. We need *wall time → instant*, which
   needs a fixed point: guess the offset at the naive instant, re-probe at the corrected instant, and
   use the second answer if it differs. That naive two-pass **does not reproduce the ES convention** for
   ambiguous times — verified, `Europe/Berlin` 2026-10-25 02:30: two-pass → `2026-10-25T01:30:00.000Z`
   (the *later*, CET occurrence), whereas `new Date(2026, 9, 25, 2, 30)` → `2026-10-25T00:30:00.000Z`
   (the *earlier*, CEST one). Matching Q4's convention requires an explicit disambiguation branch.
2. **Locale-sensitive output.** "Localized GMT format" means CLDR decides the text; pin `'en-US'`.
   ICU 78.3 emits `GMT+00:00` for a zero offset, but the format permits a bare `GMT`, so keep the
   fallback branch.
3. **Needs full ICU.** Verified: `process.config.variables.icu_small === false`, `process.versions.icu === '78.3'`.
   Node ships full-icu by default; a `--with-intl=small-icu` build would degrade.
4. **Invalid zone throws**, it does not fall back: `new Intl.DateTimeFormat('en', { timeZone: 'Europe/Nowhere' })`
   → `RangeError: Invalid time zone specified: Europe/Nowhere`. `Intl.supportedValuesOf('timeZone')`
   (418 entries on this build) is the cheap validator for a stored IANA id.
5. **Zone data ages with the image.** `process.versions.tz === '2026c'`. A rule change published after the
   image is built yields wrong offsets for future dates. Immaterial for a 14-day window, but it is the
   structural argument *against* the "store the zone, resolve later" design generally.
6. **No `Temporal`.** `typeof globalThis.Temporal === 'undefined'` on Node 22.23.3, so none of this
   collapses into a one-liner yet.

For the *other* direction (UTC instant → owner-local wall clock, which the server would need if it ever
rendered or re-derived an owner-local date), the same API with `hourCycle: 'h23'` yields parseable parts:

```
[{"type":"month","value":"11"},…,{"type":"hour","value":"01"},{"type":"minute","value":"30"},
 {"type":"second","value":"00"},…,{"type":"timeZoneName","value":"GMT-04:00"}]
```

Recorded as a fallback only. Adopting it means storing the IANA zone, which decision 5 rules out.

---

## Q4 — The spring-forward hole and the fall-back duplicate

### The convention

ECMA-262 §21.4.1.26 `UTC ( t )` — the operation the `Date(year, month, …)` constructor and every
local-time setter run — contains this normative NOTE:

> NOTE: The following steps ensure that when *t* represents local time repeating multiple times at a
> negative time zone transition (e.g. when the daylight saving time ends or the time zone offset is
> decreased due to a time zone rule change) or skipped local time at a positive time zone transition
> (e.g. when the daylight saving time starts or the time zone offset is increased due to a time zone
> rule change), *t* is interpreted using **the time zone offset before the transition**.

Mechanically: `possibleInstants` is computed for the wall-clock fields; if it is non-empty,
`disambiguatedInstant` is `possibleInstants[0]` (**the earlier** of the two); if it is empty, the
algorithm walks back to the last local time that does exist and takes the offset there.

This is exactly `Temporal`'s **`disambiguation: "compatible"`**, the Temporal default: MDN's examples
show `"compatible"` is equivalent to `"later"` for non-existent times (`2024-03-10T02:05` in New York →
`03:05-04:00`) and to `"earlier"` for ambiguous ones (`2024-11-03T01:05` → `01:05-04:00`). It is also
what `java.time.ZonedDateTime.of`, ICU, Luxon, date-fns-tz and Moment do.

**Name to use in the spec: "compatible" disambiguation — earlier for a repeated time, push forward past
the gap for a skipped time.**

### What each candidate actually produces

`TZ=Europe/Berlin`, the gap 02:00–02:59 on 2026-03-29:

```
-- new Date(Y, M-1, D, h, m)  (= Option C, = the ES convention) --
01:45 -> 2026-03-29T00:45:00.000Z (renders 01:45)   ok
02:00 -> 2026-03-29T01:00:00.000Z (renders 03:00)   pushed forward 1 h
02:30 -> 2026-03-29T01:30:00.000Z (renders 03:30)   pushed forward 1 h
03:00 -> 2026-03-29T01:00:00.000Z (renders 03:00)   collides with 02:00

-- per-date offset at local noon (= Option A, off = -120) --
01:45 -> 2026-03-28T23:45:00.000Z (renders 00:45)   wrong by -1 h, still on the right date
02:00 -> 2026-03-29T00:00:00.000Z (renders 01:00)   invented a time inside the gap's shadow
03:00 -> 2026-03-29T01:00:00.000Z (renders 03:00)   ok

-- per-date offset at local 00:00 (off = -60) --
02:30 -> 2026-03-29T01:30:00.000Z (renders 03:30)   same as ES here
03:00 -> 2026-03-29T02:00:00.000Z (renders 04:00)   wrong by +1 h for the whole rest of the day
```

The duplicate 02:00–02:59 on 2026-10-25:

```
-- new Date(...) --
02:00 -> 2026-10-25T00:00:00.000Z (renders 02:00)   first (CEST) occurrence  <- possibleInstants[0]
02:30 -> 2026-10-25T00:30:00.000Z (renders 02:30)   first occurrence
03:00 -> 2026-10-25T02:00:00.000Z (renders 03:00)   ok

-- per-date offset at local noon (off = -60) --
01:45 -> 2026-10-25T00:45:00.000Z (renders 02:45)   wrong by +1 h
02:30 -> 2026-10-25T01:30:00.000Z (renders 02:30)   second (CET) occurrence — the other choice
```

Both occurrences are real instants and both render as `02:30` locally:

```
02:30 first  (CEST) = 2026-10-25T00:30:00.000Z  renders 25/10/2026, 02:30
02:30 second (CET)  = 2026-10-25T01:30:00.000Z  renders 25/10/2026, 02:30
new Date(2026, 9, 25, 2, 30) picks: 2026-10-25T00:30:00.000Z
```

### Two consequences the spec must state explicitly

**1. On a spring-forward date, an interval inside the gap collapses to zero length.** Decision 2 allows
several intervals per day, so this is reachable:

```
interval 02:00-03:00 on 2026-03-29 -> 2026-03-29T01:00:00.000Z .. 2026-03-29T01:00:00.000Z   (empty!)
interval 03:00-04:00 on 2026-03-29 -> 2026-03-29T01:00:00.000Z .. 2026-03-29T02:00:00.000Z
```

The first interval yields an empty slot ladder (decision 3 drops the tail that does not fit — here the
whole thing). The second starts at the same instant, so the two intervals are no longer disjoint in
UTC even though they were disjoint as wall times. **The `PUT` validator must reject `start >= end`
after expansion**, with the interval compared in UTC, not in `"HH:MM"`.

**2. On a fall-back date, the repeated hour's second pass is unreachable, and the day is 25 hours long.**
With "compatible" disambiguation, `02:00`–`02:45` always resolve to the CEST occurrence; no `"HH:MM"`
the owner can type names the CET one. That hour is simply not bookable. This is the normal, accepted
behaviour of every wall-clock scheduler and needs one sentence in the spec, not a feature.

### Recommended convention for the spec

- Adopt **"compatible"** disambiguation — which is what you get for free by letting the client build the
  instant with `new Date(Y, M-1, D, hh, mm)`. No code, no branches, matches Temporal's default, so a
  later migration to `Temporal` changes nothing.
- Do **not** adopt `"reject"`: the owner has no way to resolve the ambiguity in a `"HH:MM"` UI, and a
  `422` on "02:30 does not exist on this date" is a worse experience than silently scheduling at 03:30
  once every few years.
- State both consequences above in the spec and cover them with two scenario tests
  (gap interval → `422` on `start >= end`; fall-back day → ladder built from the earlier occurrence).

---

## Recommendation

**Change decision 7's wire shape: the client sends fully-formed UTC instants
(`{ start: "…Z", end: "…Z" }`, TypeSpec `utcDateTime`) and the server stores them verbatim.
No offset travels; no expansion code exists.**

Rationale:

1. **It is the only correct option.** 0 / 1440 round-trip errors on a fall-back window and 4 / 1440 on a
   spring-forward window, where those four cells are wall times that do not exist in any formulation.
   A single "now" offset is wrong on 568–756 of 1440 cells for ~8.2 % of the calendar year; a per-date
   offset is still wrong on 8–12 cells of each transition date.
2. **It is less code, not more.** The server stops owning an arithmetic problem it has no data to solve.
   `new Date(body.start)` replaces `Date.UTC(...) + off * 60_000` plus a sign convention plus a
   disambiguation policy. The one thing the server keeps is validation: 15-minute grid, `start < end`,
   inside the addressed owner-local date, inside the window.
3. **It respects decisions 5 and 9 unchanged.** No IANA zone is stored. The API stays UTC ISO 8601 —
   in fact it becomes *more* consistent with it, since `Meeting.start/end` and `Slot.start` are already
   `utcDateTime` in `contract/main.tsp`.
4. **It gets Q4 right for free.** The browser runs ECMA-262 §21.4.1.26 against the full IANA database it
   already ships, giving "compatible" disambiguation with no branch to write or test on the server.
5. **The client already has the pieces.** `web/src/localTime.ts` already does the inverse direction
   (`toDateString`, `formatLocalTime`) with the native local-time accessors, which are DST-correct by the
   same spec machinery. Adding `toInstant(date, "HH:MM")` is three lines next to them, and the owner UI
   keeps editing `"HH:MM"` — the change is in what the API carries, not in what the owner types.

**If decision 7's `"HH:MM"` wire shape is treated as frozen**, the fallback is the per-date offset
(Option A): it removes the 568/756-cell failure for one extra integer per request, and leaves only the
transition-date residue. That residue must then be written into the spec as a known defect, because it
cannot be fixed without a second offset per day. The single "now" offset should not ship in any form.

### What this does not decide (candidates for their own tickets)

- **Whose calendar defines "today … today + 14"?** Decision 9 says calendar dates, but the server's UTC
  date and the owner's local date differ at the edges — at `2026-10-06T22:30:00Z` it is `2026-10-07` in
  `Europe/Berlin` and `Pacific/Kiritimati` but still `2026-10-06` in `UTC` and `Pacific/Midway`. Whether
  the window, the "past cells are not rendered" rule (decision 4) and the `GET` filter use the owner's,
  the guest's, or the server's notion of the date is unresolved by this research and is orthogonal to
  the expansion question.
- **Does the 15-minute grid survive expansion?** Yes, for every zone in the current tz database: sweeping
  all 418 `Intl.supportedValuesOf('timeZone')` entries over 14 monthly samples produced 39 distinct
  offsets, all multiples of 15 minutes (`GMT+05:45` and `GMT+12:45` are the extremes). So a grid check
  can be applied to the stored UTC instants directly.

---

## Sources

- ECMA-262, §21.4.1.26 `UTC ( t )` — the disambiguation NOTE ("interpreted using the time zone offset
  before the transition"), `possibleInstants[0]`, `possibleInstantsBefore`:
  https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-utc-t
- ECMA-262, §21.4.1.25 `LocalTime ( t )` — Note 3 (`UTC(LocalTime(tv))` is not necessarily `tv`):
  https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-localtime
- ECMA-262, §21.4.4.11 `Date.prototype.getTimezoneOffset ( )` — `(tv - LocalTime(tv)) / msPerMinute`:
  https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date.prototype.gettimezoneoffset
- ECMA-402, Table 16 "DateTimeFormat Components" — `[[TimeZoneName]]` accepts
  `"short" | "long" | "shortOffset" | "longOffset" | "shortGeneric" | "longGeneric"`:
  https://tc39.es/ecma402/#sec-intl-datetimeformat-constructor
- MDN, `Date.prototype.getTimezoneOffset()` — sign convention ("for UTC+10, `-600` will be returned")
  and the DST non-uniformity note:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTimezoneOffset
- MDN, `Intl.DateTimeFormat()` constructor — `timeZone` accepts IANA names and offset identifiers;
  `longOffset` = "Long localized GMT format" (`GMT-08:00`), `shortOffset` = `GMT-8`:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat
- MDN, `Temporal.ZonedDateTime.from()` — the `disambiguation` option, default `"compatible"`;
  examples showing `"compatible"` = `"later"` for skipped times and `"earlier"` for ambiguous ones:
  https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/ZonedDateTime/from
- Node.js v22 Intl docs — full-icu in default builds:
  https://nodejs.org/docs/latest-v22.x/api/intl.html
- IANA Time Zone Database (the data ECMA-262 Note 2 requires implementations to use):
  https://www.iana.org/time-zones
- `@typespec/compiler` `lib/intrinsics.tsp` (`plainDate`, `plainTime`, `utcDateTime`, `offsetDateTime`)
  and `@typespec/openapi3` `dist/src/std-scalar-schemas.js` (both date-time scalars emit
  `{type: string, format: date-time}`) — read from `node_modules/` at the pinned versions.
- Empirical: Node **22.23.3**, ICU **78.3**, `process.versions.tz` **2026c**, run under
  `TZ=Europe/Berlin` and `TZ=America/New_York`. All quoted blocks are verbatim program output.
