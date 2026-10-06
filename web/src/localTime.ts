// Formatting a UTC ISO instant in the viewer's local time — shared by
// GuestPage (confirmation screen) and OwnerPage (meetings list).

// HH:mm in the viewer's local time.
export function formatLocalTime(iso: string): string {
  const date = new Date(iso)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 'YYYY-MM-DD' in the viewer's local calendar, matching Mantine's DatePicker value format.
export function toDateString(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// 'YYYY-MM-DD HH:mm' in the viewer's local time.
export function formatLocalDateTime(iso: string): string {
  return `${toDateString(new Date(iso))} ${formatLocalTime(iso)}`
}

export function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// 'YYYY-MM-DD' of an instant, in the viewer's local calendar — not UTC (see
// issue #39). Bins GuestPage's flat slot list into its day cells, and
// OwnerPage's meetings into calendar days; on OwnerPage the viewer is the
// owner, so this is the owner's own local date there.
export function localDateOf(iso: string): string {
  return toDateString(new Date(iso))
}

/**
 * A local date ('YYYY-MM-DD') plus a local wall time ('HH:MM') as a UTC instant.
 *
 * The browser owns this conversion on purpose: it is the only party that knows
 * the offset in force on *that* date, so a DST transition inside the booking
 * window does not shift the hours the owner typed. See
 * docs/research/local-time-to-utc.md.
 */
export function toUtcInstant(date: string, time: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(year!, month! - 1, day!, hours!, minutes!, 0, 0).toISOString()
}

/** Every 'HH:MM' on the 15-minute grid, '00:00' … '23:45'. */
export function quarterHourOptions(): string[] {
  const options: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
    const mm = String(minutes % 60).padStart(2, '0')
    options.push(`${hh}:${mm}`)
  }
  return options
}
