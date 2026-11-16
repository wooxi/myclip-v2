CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  room        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('text', 'file')),
  content     TEXT,
  file_name   TEXT,
  file_size   INTEGER,
  mime        TEXT,
  file_key    TEXT,
  source      TEXT,
  status      TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('pending', 'ready')),
  upload_id   TEXT,
  expire_at   INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_room_time ON items(room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_expire ON items(expire_at) WHERE expire_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status) WHERE status = 'pending';
