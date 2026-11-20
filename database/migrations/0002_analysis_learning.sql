CREATE TABLE feedback_analyses (
  feedback_id TEXT PRIMARY KEY NOT NULL REFERENCES feedback(id),
  label TEXT NOT NULL CHECK(label IN ('positive','negative','neutral','mixed','unreviewed')),
  language TEXT NOT NULL,
  source TEXT NOT NULL,
  details TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE correction_memory (
  session_id TEXT NOT NULL REFERENCES sessions(id),
  text_key TEXT NOT NULL,
  original_text TEXT NOT NULL,
  label TEXT NOT NULL CHECK(label IN ('positive','negative','neutral','mixed')),
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(session_id, text_key)
);

-- Import existing lecturer reviews. Later edits win when two comments share a key.
INSERT INTO correction_memory(session_id,text_key,original_text,label,updated_at)
SELECT f.session_id,feedwise_text_key(f.comment),f.comment,r.label,r.updated_at
FROM reviews r JOIN feedback f ON f.id=r.feedback_id
WHERE 1 ORDER BY r.updated_at,r.rowid
ON CONFLICT(session_id,text_key) DO UPDATE SET
  original_text=excluded.original_text,label=excluded.label,updated_at=excluded.updated_at,
  revision=correction_memory.revision+1;
