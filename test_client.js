const { spawn } = require('child_process');
const path = require('path');

// Start the MCP Server
const serverProcess = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'inherit'] // Pipe stdin/stdout, inherit stderr for logs
});

let requestId = 0;

function sendRequest(method, params) {
  const request = {
    jsonrpc: '2.0',
    id: requestId++,
    method: method,
    params: params
  };
  const json = JSON.stringify(request);
  // console.log(`[CLIENT] Sending: ${json.substring(0, 100)}...`);
  serverProcess.stdin.write(json + '\n');
}

let buffer = '';
serverProcess.stdout.on('data', (data) => {
  buffer += data.toString();
  let dindex = buffer.indexOf('\n');
  while (dindex !== -1) {
    const line = buffer.substring(0, dindex);
    buffer = buffer.substring(dindex + 1);
    dindex = buffer.indexOf('\n');
    
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.log(`[DEBUG] Received: ${JSON.stringify(response).substring(0, 150)}...`); // Log raw response
      handleResponse(response);
    } catch (e) {
      console.log('[SERVER LOG/RAW]:', line);
    }
  }
});

function handleResponse(response) {
  if (response.error) {
      console.error('❌ JSON-RPC Error:', response.error);
      return;
  }
  
  if (response.result && response.result.isError) {
      console.error('❌ Tool Execution Error:', response.result.content[0].text);
      return;
  }

  if (response.result && response.result.content) {
    const content = response.result.content[0].text;
    // console.log('[DEBUG] Content:', content.substring(0, 50));
    
    // Check if this is the connect_database response containing instructions
    if (content.includes('--- AUTOMATIC INSTRUCTIONS ---')) {
      console.log('\n✅ TEST 1: Connection & Instruction Injection passed.');
      console.log('   Server returned instructions automatically.');
      
      // Step 2a: Create Table
      console.log('\n🔄 TEST 2a: Architect Agent creating table...');
      sendRequest('tools/call', {
        name: 'write_query',
        arguments: {
          query: "CREATE TABLE IF NOT EXISTS _architecture_notes (id INTEGER PRIMARY KEY, note TEXT);"
        }
      });
    }
    // Check write_query result (Table Creation)
    else if (content.includes('changes') && !content.includes('Architecture DB initialized') && requestId === 3) {
         // Note: We check requestId to distinguish between the CREATE (id 2) and INSERT (id 3) if needed, 
         // but simpler is to just chain them.
         console.log('\n✅ TEST 2a: Table Created.');
         
         // Step 2b: Insert Data
         console.log('\n🔄 TEST 2b: Architect Agent inserting note...');
         sendRequest('tools/call', {
            name: 'write_query',
            arguments: {
                query: "INSERT INTO _architecture_notes (note) VALUES ('Architecture DB initialized for testing.');"
            }
         });
    }
    // Check write_query result (Insert)
    else if (content.includes('lastID') && requestId > 3) { // Simple heuristic
        console.log('\n✅ TEST 2b: Note Inserted.');
        
        // Step 3: Worker Agent reading notes
        console.log('\n🔄 TEST 3: Worker Agent reading architecture notes...');
        sendRequest('tools/call', {
            name: 'read_query',
            arguments: {
                query: "SELECT * FROM _architecture_notes"
            }
        });
    }
    // Check read_query result
    else if (content.includes('Architecture DB initialized')) {
        console.log('\n✅ TEST 3: Read Query passed.');
        console.log('   Retrieved note:', JSON.parse(content)[0].note);
        
        // Step 4: Get Schema DDL
        console.log('\n🔄 TEST 4: Requesting Schema DDL...');
        sendRequest('tools/call', {
            name: 'get_schema_ddl',
            arguments: {}
        });
    }
    else if (content.includes('CREATE TABLE')) {
        console.log('\n✅ TEST 4: Schema DDL passed.');
        console.log('   Server returned DDL:\n', content.trim());
        console.log('\n🎉 ALL SYSTEMS GO! Terminating test.');
        process.exit(0);
    }
  }
  
  // Handle Initialization response
  if (response.result && response.result.capabilities) {
      console.log('✅ Server Initialized.');
      // Step 1: Connect
      console.log('\n🔄 TEST 1: Connecting to database...');
      sendRequest('tools/call', {
          name: 'connect_database',
          arguments: { db_path: path.join(__dirname, 'test_mcp.sqlite') }
      });
  }
}

// Initial Handshake
sendRequest('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'test-client', version: '1.0' }
});
