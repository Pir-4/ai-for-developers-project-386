-- Event types are gone: duration is now chosen by the guest per booking, from
-- the fixed set 15/30/45. Bookings are rebuilt without the event-type key.
-- The project has no deployment and data/app.db is gitignored, so no data is
-- carried over.
DROP TABLE bookings;

DROP TABLE event_types;

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (15, 30, 45)),
  guest_name TEXT NOT NULL CHECK (length(guest_name) BETWEEN 1 AND 100),
  guest_email TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_bookings_owner_email_start ON bookings (owner_email, start);
