# SQLite MCP Instructions for AI Agents

**IMPORTANT: READ FIRST**
The schemas and queries below are **EXAMPLES and PATTERNS** for creating new workflows.
To understand the **ACTUAL** structure of the existing database you are connected to, you **MUST** call the tool `get_schema_ddl`. Never guess column names based on these examples if the table already exists.

These guidelines are optimized for autonomous agents performing iterative tasks (e.g., scraping, job queues, data accumulation).

## 1. Critical Rules (System Stability)
*   **Idempotency is Key:** Always assume your script might run multiple times. Use `IF NOT EXISTS` when creating tables.
*   **SQLite Syntax Only:** Do NOT use MySQL/Postgres specific functions. Use `datetime('now')` for timestamps.
*   **Transactions:** For multi-step operations (e.g., read + update status), trust the atomic nature of single queries or ask for transaction guidance if needed.

## 2. Context Preservation (Self-Documentation)
**CRITICAL:** Future agents won't know *why* you designed the schema this way.
*   **The "Architect" Agent:** If you create tables, you MUST create a table named `_architecture_notes` and insert rows explaining:
    *   The purpose of each table.
    *   The meaning of specific status flags (e.g., "status='ERROR_404' means retry later").
    *   Relationships between tables.
*   **The "Worker" Agent:** Always `SELECT * FROM _architecture_notes` after connecting to understand the logic.

```sql
CREATE TABLE IF NOT EXISTS _architecture_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- Example:
INSERT INTO _architecture_notes (note) VALUES ('Table "queue" is for raw URLs. "processed" table is for final JSON.');
```

## 3. Standard Schema Pattern (Job/Item Queues)
When creating tables to track items (URLs, emails, jobs), ALWAYS use this structure:

```sql
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    value TEXT NOT NULL UNIQUE,  -- The URL, email, or core data
    status TEXT DEFAULT 'pending', -- pending, processing, completed, error
    result TEXT,                 -- Output of the processing
    error_message TEXT,          -- If failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 3. Workflow Patterns & Query Examples

### A. Initialization
Check if the table exists or create it safely.
```sql
CREATE TABLE IF NOT EXISTS processed_urls ( ... );
```

### B. Fetching the "Next" Item to Process
To avoid race conditions or reprocessing, find the oldest 'pending' item.
```sql
SELECT * FROM items WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;
```

### C. Inserting New Data (Deduplication)
Don't crash if duplicates arrive. Use `INSERT OR IGNORE` or `INSERT ... ON CONFLICT`.
```sql
INSERT OR IGNORE INTO items (value) VALUES ('https://example.com');
```

### D. Updating Progress
Mark as 'completed' or 'error' and update the timestamp.
```sql
UPDATE items 
SET status = 'completed', result = 'Scraped content...', updated_at = datetime('now') 
WHERE id = 42;
```

### E. Stats & Monitoring
Check progress.
```sql
SELECT status, COUNT(*) as count FROM items GROUP BY status;
```

### F. Cleanup / Reset
Reset stuck jobs (e.g., stuck in 'processing' for > 1 hour).
```sql
UPDATE items SET status = 'pending' 
WHERE status = 'processing' AND updated_at < datetime('now', '-1 hour');
```