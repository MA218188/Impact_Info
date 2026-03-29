import hashlib
import sqlite3
import os
import time

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "health_data.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    filename    TEXT    NOT NULL,
    file_hash   TEXT    NOT NULL UNIQUE,
    content     BLOB    NOT NULL,
    ingested_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS health_events (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    type                 TEXT    NOT NULL,
    data_type_id         INTEGER NOT NULL,
    start_ms             INTEGER NOT NULL,
    end_ms               INTEGER NOT NULL,
    value                REAL,
    source_id            INTEGER,
    source_name          TEXT,
    generation_type      TEXT,
    offset_utc_minutes   INTEGER,
    created_at_ms        INTEGER,
    event_category       TEXT,
    event_description    TEXT,
    timestamp_confidence TEXT,
    source_text_quote    TEXT,
    document_id          INTEGER REFERENCES documents(id),
    UNIQUE (type, start_ms, source_id, value)
);

CREATE INDEX IF NOT EXISTS idx_type       ON health_events(type);
CREATE INDEX IF NOT EXISTS idx_start_ms   ON health_events(start_ms);
CREATE INDEX IF NOT EXISTS idx_type_start ON health_events(type, start_ms);
CREATE INDEX IF NOT EXISTS idx_doc_id     ON health_events(document_id);
"""


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        # Migrate existing DBs that predate the document_id column
        try:
            conn.execute("ALTER TABLE health_events ADD COLUMN document_id INTEGER REFERENCES documents(id)")
        except sqlite3.OperationalError:
            pass  # column already exists


def insert_document(filename: str, content: bytes) -> int:
    """Store a document (PDF etc.). Returns existing or new document_id.
    The same file (by SHA-256) is stored only once."""
    file_hash = hashlib.sha256(content).hexdigest()
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM documents WHERE file_hash = ?", (file_hash,)).fetchone()
        if row:
            return row["id"]
        conn.execute(
            "INSERT INTO documents (filename, file_hash, content, ingested_at) VALUES (?,?,?,?)",
            (filename, file_hash, content, int(time.time() * 1000)),
        )
        return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def get_document_meta(doc_id: int) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, filename, ingested_at FROM documents WHERE id = ?", (doc_id,)
        ).fetchone()
        return dict(row) if row else None


def get_document_content(doc_id: int) -> bytes | None:
    with get_connection() as conn:
        row = conn.execute("SELECT content FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return row["content"] if row else None


def list_documents() -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, filename, ingested_at FROM documents ORDER BY ingested_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def insert_records(records: list[dict], document_id: int | None = None) -> int:
    """Bulk-insert records. Duplicates are silently ignored. Returns count inserted."""
    if not records:
        return 0

    rows = [
        (
            r.get("type"),
            r.get("dataTypeId"),
            r.get("startMs"),
            r.get("endMs"),
            r.get("value") if not isinstance(r.get("value"), bool) else int(r["value"]),
            r.get("sourceId"),
            r.get("sourceName"),
            r.get("generationType"),
            r.get("offsetToUtcMinutes"),
            r.get("createdAtMs"),
            r.get("event_category"),
            r.get("event_description"),
            r.get("timestamp_confidence"),
            r.get("source_text_quote"),
            document_id,
        )
        for r in records
    ]

    sql = """
        INSERT OR IGNORE INTO health_events
            (type, data_type_id, start_ms, end_ms, value, source_id, source_name,
             generation_type, offset_utc_minutes, created_at_ms,
             event_category, event_description, timestamp_confidence, source_text_quote,
             document_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """
    with get_connection() as conn:
        conn.executemany(sql, rows)
        return conn.execute("SELECT changes()").fetchone()[0]


def query_events(
    type_filter: str | None = None,
    start_ms: int | None = None,
    end_ms: int | None = None,
    document_id: int | None = None,
    limit: int | None = None,
) -> list[dict]:
    clauses = []
    params: list = []

    if type_filter:
        clauses.append("type = ?")
        params.append(type_filter)
    if start_ms is not None:
        clauses.append("start_ms >= ?")
        params.append(start_ms)
    if end_ms is not None:
        clauses.append("end_ms <= ?")
        params.append(end_ms)
    if document_id is not None:
        clauses.append("document_id = ?")
        params.append(document_id)

    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    limit_clause = f"LIMIT {int(limit)}" if limit else ""
    sql = f"SELECT * FROM health_events {where} ORDER BY start_ms {limit_clause}"

    with get_connection() as conn:
        rows = conn.execute(sql, params).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_type_counts() -> list[dict]:
    sql = "SELECT type, COUNT(*) as count FROM health_events GROUP BY type ORDER BY type"
    with get_connection() as conn:
        rows = conn.execute(sql).fetchall()
    return [{"type": r["type"], "count": r["count"]} for r in rows]


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    return {
        "id": d["id"],
        "type": d["type"],
        "dataTypeId": d["data_type_id"],
        "startMs": d["start_ms"],
        "endMs": d["end_ms"],
        "value": d["value"],
        "sourceId": d["source_id"],
        "sourceName": d["source_name"],
        "generationType": d["generation_type"],
        "offsetToUtcMinutes": d["offset_utc_minutes"],
        "createdAtMs": d["created_at_ms"],
        "event_category": d["event_category"],
        "event_description": d["event_description"],
        "timestamp_confidence": d["timestamp_confidence"],
        "source_text_quote": d["source_text_quote"],
        "documentId": d["document_id"],
    }
