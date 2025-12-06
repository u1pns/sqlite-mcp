#!/usr/bin/env node
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

// Function to log messages to a daily file
function logMessage(message, type = 'info') {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const logFileName = `${date}.log`;
  const logFilePath = path.join(LOG_DIR, logFileName);
  const timestamp = now.toISOString();
  const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}\n`;

  fs.appendFile(logFilePath, logEntry, (err) => {
    // Fail silently
  });
}

// Initialize Database State
let db = null;
let currentDbPath = null;

function connectToDatabase(dbPath) {
  return new Promise((resolve, reject) => {
    // Close existing connection if any
    if (db) {
      db.close((err) => {
        if (err) logMessage(`Error closing previous database: ${err.message}`, 'error');
      });
    }

    const newDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        logMessage(`Error opening database ${dbPath}: ${err.message}`, 'error');
        reject(err);
      } else {
        db = newDb;
        currentDbPath = dbPath;
        logMessage(`Connected to SQLite database: ${dbPath}`, 'info');
        resolve();
      }
    });
  });
}

// Initial connection if ENV is provided (backward compatibility)
if (process.env.SQLITE_DB_PATH) {
  connectToDatabase(process.env.SQLITE_DB_PATH).catch(err => {
    console.error(`Failed to connect to initial DB: ${err.message}`);
  });
} else {
    // Optional: Connect to default if desired, or leave null to require explicit connection
    // connectToDatabase(path.join(__dirname, 'database.sqlite'));
}

// Helper for SELECT queries
function dbQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('No database connected. You MUST call the "connect_database" tool first to connect to or create a database file.'));
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper for INSERT, UPDATE, DELETE, CREATE, DROP
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error('No database connected. You MUST call the "connect_database" tool first to connect to or create a database file.'));
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

// Initialize MCP Server
const server = new Server(
  {
    name: 'sqlite-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'connect_database',
        description: 'Connect to a specific SQLite database file. Creates the file if it does not exist.',
        inputSchema: {
          type: 'object',
          properties: {
            db_path: {
              type: 'string',
              description: 'The ABSOLUTE path to the SQLite database file (e.g., /Users/user/project/db.sqlite). Relative paths will be created in the MCP server directory, which is likely NOT what you want.',
            },
          },
          required: ['db_path'],
        },
      },
      {
        name: 'read_query',
        description: 'Execute a SELECT query on the SQLite database',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL SELECT query to execute',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'write_query',
        description: 'Execute an INSERT, UPDATE, DELETE, or CREATE query',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The SQL query to execute',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_tables',
        description: 'List all tables in the database',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'describe_table',
        description: 'Get the schema information for a specific table',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: 'The name of the table to describe',
            },
          },
          required: ['table_name'],
        },
      },
      {
        name: 'get_schema_ddl',
        description: 'Returns the full DDL (CREATE TABLE statements) of the database to understand the complete schema structure.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_custom_instructions',
        description: 'Returns custom guidelines, best practices, and example queries defined in instructions.md.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'connect_database') {
      const { db_path } = args;
      logMessage(`Executing connect_database: ${db_path}`, 'info');
      await connectToDatabase(db_path);

      // Auto-inject instructions
      const instructionsPath = path.join(__dirname, 'instructions.md');
      let message = `Successfully connected to database at ${db_path}`;
      
      if (fs.existsSync(instructionsPath)) {
        const instructions = fs.readFileSync(instructionsPath, 'utf8');
        message += `\n\n--- AUTOMATIC INSTRUCTIONS ---\n${instructions}`;
      }

      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    }
    
    if (name === 'read_query') {
      const { query } = args;
      logMessage(`Executing read_query: ${query}`, 'info');
      
      // Basic safety check (very primitive, ideally use a read-only connection or strict parsing)
      if (!query.trim().toLowerCase().startsWith('select') && !query.trim().toLowerCase().startsWith('pragma')) {
         throw new Error('read_query only supports SELECT or PRAGMA statements.');
      }

      const rows = await dbQuery(query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    }

    if (name === 'write_query') {
      const { query } = args;
      logMessage(`Executing write_query: ${query}`, 'info');
      const result = await dbRun(query);
      
      let responseText = JSON.stringify(result, null, 2);
      
      // Active Reinforcement: Check if a table was created and remind about documentation
      if (query.toLowerCase().includes('create table')) {
        responseText += `\n\n⚠️ ARCHITECTURE CHECK: You just created a table. If you haven't already, you MUST now insert a row into '_architecture_notes'.\nYour note MUST explain:\n1. The table's Purpose.\n2. Key columns (especially status/state flags).\n3. Relationships to other data.\n\nExample: INSERT INTO _architecture_notes (note) VALUES ('Table "queue" stores pending jobs. "status" column tracks progress. Linked to "users" via user_id.');`;
      }

      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    }

    if (name === 'list_tables') {
      logMessage('Executing list_tables', 'info');
      const query = "SELECT name FROM sqlite_master WHERE type='table'";
      const rows = await dbQuery(query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    }

    if (name === 'describe_table') {
      const { table_name } = args;
      logMessage(`Executing describe_table: ${table_name}`, 'info');
      const query = `PRAGMA table_info(${table_name})`;
      const rows = await dbQuery(query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    }

    if (name === 'get_schema_ddl') {
      logMessage('Executing get_schema_ddl', 'info');
      const query = "SELECT sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL";
      const rows = await dbQuery(query);
      // Extract the SQL statements and join them
      const ddl = rows.map(row => row.sql).join('\n\n');
      return {
        content: [
          {
            type: 'text',
            text: ddl || 'No tables found.',
          },
        ],
      };
    }

    if (name === 'get_custom_instructions') {
      logMessage('Executing get_custom_instructions', 'info');
      const instructionsPath = path.join(__dirname, 'instructions.md');
      let instructionsContent = 'No instructions.md file found.';
      
      if (fs.existsSync(instructionsPath)) {
        instructionsContent = fs.readFileSync(instructionsPath, 'utf8');
      }

      return {
        content: [
          {
            type: 'text',
            text: instructionsContent,
          },
        ],
      };
    }

    throw new Error(`Tool not found: ${name}`);
  } catch (error) {
    logMessage(`Error executing ${name}: ${error.message}`, 'error');
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Connect transport
async function run() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logMessage('SQLite MCP Server running on stdio', 'info');
  } catch (error) {
    logMessage(`Failed to start MCP server: ${error.message}`, 'error');
    console.error(`Fatal error starting server: ${error.message}`);
    process.exit(1);
  }
}

run().catch((error) => {
  logMessage(`Fatal error: ${error}`, 'error');
  process.exit(1);
});
