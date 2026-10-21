-- Event types are back: an owner defines kinds of bookable meetings (name,
-- description, duration), and every booking belongs to one of them. The slot
-- length comes from the event type; duration_minutes on the booking snapshots
-- it. The CHECKs mirror the contract constraints: the DB is the last line of
-- defense. Existing bookings have no event type to point at, so bookings are
-- rebuilt without carrying them over (as in 004).
CREATE TABLE event_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  duration_minutes INTEGER NOT NULL
    CHECK (duration_minutes % 15 = 0 AND duration_minutes BETWEEN 15 AND 240)
);

CREATE INDEX idx_event_types_owner_email ON event_types (owner_email);

DROP TABLE bookings;

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type_id INTEGER NOT NULL REFERENCES event_types (id),
  owner_email TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL
    CHECK (duration_minutes % 15 = 0 AND duration_minutes BETWEEN 15 AND 240),
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_bookings_owner_email_start ON bookings (owner_email, start);
