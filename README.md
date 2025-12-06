# SQLite MCP Server

A Model Context Protocol (MCP) server that provides SQLite database interaction capabilities. This server allows AI agents (like Gemini CLI, Claude, etc.) to query and modify SQLite databases.

## Features

*   **Read Data**: Execute `SELECT` queries to retrieve data.
*   **Write Data**: Execute `INSERT`, `UPDATE`, `DELETE`, `CREATE`, and `DROP` queries.
*   **Schema Inspection**: List tables and describe table schemas.
*   **Logging**: Automatically logs queries to daily files in the `log/` directory.

## Architecture Pattern (The "Memory" System)

This MCP server implements a **Context Preservation Pattern** designed for autonomous AI agents. Since agents lose context between sessions, this server enforces a self-documenting database structure.

### The `_architecture_notes` Table
The server encourages agents to maintain a "meta-table" called `_architecture_notes`.
*   **Architect Agents** (who create tables) MUST insert notes explaining *why* a table exists and how it works.
*   **Worker Agents** (who process data) MUST read these notes to understand the system rules without needing a huge prompt context.

This turns the SQLite database into a self-contained, self-documented artifact.

## Prerequisites

*   **Node.js**: v14 or higher.

## MCP Client Configuration

To use this server with your MCP client, you need to configure it to run the `index.js` script.

### Option 1: Local Installation (Recommended for Development)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/u1pns/sqlite-mcp.git
    cd sqlite-mcp
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    
    #### Gemini CLI (`settings.json`)
    Add this to your `mcpServers` object in the `.gemini/settings.json` file:

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
    *If `SQLITE_DB_PATH` is not provided, it defaults to `database.sqlite` in the `sqlite-mcp` directory.*

### Option 2: Using `npx` (No installation required)

You can run the server directly from GitHub without cloning the repo.

#### Gemini CLI (`settings.json`)
```json
{
  "mcpServers": {
    "sqlite-mcp": {
      "command": "npx",
      "args": ["-y", "github:u1pns/sqlite-mcp"],
      "env": {
        "SQLITE_DB_PATH": "/absolute/path/to/my/db.sqlite"
      }
    }
  }
}
```
*Note: The `-y` flag is important to auto-accept the package installation.*

## Tools

### `connect_database`
Connect to a specific SQLite database file.
*   `db_path` (string): The absolute path to the SQLite database file.
    *   *Note: If a relative path is provided, the database will be created inside the MCP server's directory, not the user's current directory. Always prefer absolute paths.*
*   **Feature**: Automatically returns custom instructions and best practices (from `instructions.md`) upon successful connection.

### `read_query`
Execute a SELECT query.
*   `query` (string): The SQL query (must start with SELECT or PRAGMA).

### `write_query`
Execute a write query.
*   `query` (string): The SQL query.

### `list_tables`
List all tables in the database.

### `describe_table`
Get schema info for a specific table.
*   `table_name` (string): Name of the table.

### `get_schema_ddl`
Returns the full `CREATE TABLE` statements for the entire database.
*   **Use this** instead of guessing table structures. It provides the ground truth of the database schema.

### `get_custom_instructions`
Returns the content of `instructions.md`. Useful for re-reading best practices without reconnecting.

## License

MIT License

Copyright (c) 2024 u1pns

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
