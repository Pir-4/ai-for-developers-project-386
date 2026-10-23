-- One predefined owner (from the server config, not the database) and a fixed
-- 30-minute slot on a 30-minute grid. owner_email goes away from every table.
-- Rows that do not fit the new rules are dropped rather than converted: event
-- types and bookings of any other duration, and availability bounds off the
-- 30-minute grid. Rows of every former owner are merged into the single one.
CREATE TABLE event_types_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes = 30)
);

INSERT INTO event_types_new (id, name, description, duration_minutes)
  SELECT id, name, description, duration_minutes FROM event_types
  WHERE duration_minutes = 30;

CREATE TABLE bookings_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type_id INTEGER NOT NULL REFERENCES event_types_new (id),
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes = 30),
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO bookings_new (id, event_type_id, start, end, duration_minutes, guest_name, guest_email, created_at)
  SELECT id, event_type_id, start, end, duration_minutes, guest_name, guest_email, created_at
  FROM bookings
  WHERE event_type_id IN (SELECT id FROM event_types_new)
    AND substr(start, 15, 2) IN ('00', '30');

CREATE TABLE availability_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL
);

INSERT INTO availability_new (id, date, start, end)
  SELECT id, date, start, end FROM availability
  WHERE substr(start, 15, 2) IN ('00', '30') AND substr(end, 15, 2) IN ('00', '30');

DROP TABLE bookings;
DROP TABLE event_types;
DROP TABLE availability;

ALTER TABLE event_types_new RENAME TO event_types;
ALTER TABLE bookings_new RENAME TO bookings;
ALTER TABLE availability_new RENAME TO availability;

CREATE INDEX idx_bookings_start ON bookings (start);
CREATE INDEX idx_availability_date ON availability (date);
