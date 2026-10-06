-- One event type = a kind of bookable meeting owned by an owner (email).
-- The CHECKs mirror the contract constraints: the DB is the last line of defense.
CREATE TABLE event_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 1 AND 500),
  duration INTEGER NOT NULL CHECK (duration % 15 = 0 AND duration BETWEEN 15 AND 240)
);

CREATE INDEX idx_event_types_owner_email ON event_types (owner_email);
