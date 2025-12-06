# Gemini Configuration for SQLite MCP

To use this MCP server with Gemini CLI, add the following configuration to your `.gemini/settings.json` file.

## Configuration

### Option 1: Direct Run (Easiest)
Use `npx` to run directly from GitHub.

```json
{
  "mcpServers": {
    "sqlite-mcp": {
      "command": "npx",
      "args": ["-y", "github:u1pns/sqlite-mcp"],
      "env": {
        "SQLITE_DB_PATH": "/absolute/path/to/your/database.sqlite"
      }
    }
  }
}
```

### Option 2: Local Install (For Development)

```json
{
  "mcpServers": {
    "sqlite-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/sqlite-mcp/index.js"],
      "env": {
        "SQLITE_DB_PATH": "/absolute/path/to/your/database.sqlite"
      }
    }
  }
}
```

Replace `/absolute/path/to/sqlite-mcp/index.js` with the actual full path to the `index.js` file in this directory.
Replace `/absolute/path/to/your/database.sqlite` with the path to the SQLite database you want to interact with. If the file does not exist, it will be created when the server connects (though tables will need to be created via `write_query`).

## Usage Examples

Once configured, you can ask Gemini to perform database operations. The server is designed to guide agents through best practices.

### 1. Connection (Start Here)
*   "Connect to the database at /Users/me/data/crawler.sqlite"
    *   *The server will automatically respond with connection status AND a set of instructions/best practices.*

### 2. Understanding the Database
*   "Get the database schema DDL." (`get_schema_ddl`)
    *   *Best for understanding existing tables and relationships.*
*   "Read the architecture notes."
    *   *Query the `_architecture_notes` table to understand the 'why' behind the schema.*

### 3. Manipulation
*   "Create a table named 'jobs' following the standard item queue pattern."
*   "Insert a new job URL."
*   "Get the next pending job."
