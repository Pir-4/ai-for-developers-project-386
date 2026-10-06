-- One row = one interval of an owner's availability on one date.
-- `date` is the owner's local calendar day key (YYYY-MM-DD) chosen by their
-- browser; the server treats it as an opaque grouping key. `start`/`end` are
-- UTC instants the browser already converted, so no offset is stored here.
CREATE TABLE availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_email TEXT NOT NULL,
  date TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL
);

CREATE INDEX idx_availability_owner_date ON availability (owner_email, date);
