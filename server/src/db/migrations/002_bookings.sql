-- A booking occupies a half-open interval [start, end) of one event type's
-- owner; no other booking of that owner may overlap it (enforced at the
-- service layer in a BEGIN IMMEDIATE transaction).
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type_id INTEGER NOT NULL REFERENCES event_types (id),
  owner_email TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_bookings_owner_email_start ON bookings (owner_email, start);
