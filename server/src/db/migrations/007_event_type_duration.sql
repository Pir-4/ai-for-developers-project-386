-- The owner chooses each event type's duration again: a multiple of 30, from
-- 30 to 240. Slot starts stay on the 30-minute grid. SQLite cannot alter a
-- CHECK constraint, so both tables are rebuilt and every row is carried over.
CREATE TABLE event_types_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  duration_minutes INTEGER NOT NULL
    CHECK (duration_minutes BETWEEN 30 AND 240 AND duration_minutes % 30 = 0)
);

INSERT INTO event_types_new (id, name, description, duration_minutes)
  SELECT id, name, description, duration_minutes FROM event_types;

CREATE TABLE bookings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type_id INTEGER NOT NULL REFERENCES event_types_new (id),
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL
    CHECK (duration_minutes BETWEEN 30 AND 240 AND duration_minutes % 30 = 0),
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO bookings_new (id, event_type_id, start, end, duration_minutes, guest_name, guest_email, created_at)
  SELECT id, event_type_id, start, end, duration_minutes, guest_name, guest_email, created_at
  FROM bookings;

DROP TABLE bookings;
DROP TABLE event_types;

ALTER TABLE event_types_new RENAME TO event_types;
ALTER TABLE bookings_new RENAME TO bookings;

CREATE INDEX idx_bookings_start ON bookings (start);
