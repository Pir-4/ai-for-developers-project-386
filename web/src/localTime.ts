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
