#!/usr/bin/env node

/**
 * AgentBridge Generic Native Host
 *
 * This script is the single entry point that Chrome will execute.
 * It reads a message from stdin, which must be in the format:
 * { "hostName": "com.my_app.host", "payload": { ... } }
 *
 * It will look up "com.my_app.host" in its configuration, find the
 * real script (e.g., /path/to/my_script.py), execute it, and
 * pass the "payload" to that script's stdin.
 *
 * This acts as a secure proxy and multiplexer.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

// --- Configuration ---
// This configuration is managed by the Electron app.
// It is stored in the Electron app's standard user data directory.
const CONFIG_DIR = path.join(os.homedir(), '.agent-bridge');
const CONFIG_PATH = path.join(CONFIG_DIR, 'agent-bridge-config.json');
let config = {};

// --- Error Logging ---
// Native Messaging debugging is hard. We log errors to a file.
const LOG_PATH = path.join(CONFIG_DIR, 'agent-bridge-host.log');
function logError(message) {
  try {
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${String(message)}\n`);
  } catch (e) {
    // Failsafe in case of logging issues
    process.stderr.write(`[AgentBridge] ${message}\n`);
  }
}

// --- Message Sending ---
function sendMessage(message) {
  try {
    const jsonMessage = JSON.stringify(message);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(jsonMessage), 0);
    process.stdout.write(header);
    process.stdout.write(jsonMessage);
  } catch (err) {
    logError(`Failed to send message: ${err.message}`);
  }
}

// --- Message Reading ---
let inputBuffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk]);
  try {
    processMessages();
  } catch (err) {
    logError(`Error processing message buffer: ${err.message}`);
    // Clear buffer to prevent infinite loops
    inputBuffer = Buffer.alloc(0); 
  }
});

function processMessages() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    const messageEnd = 4 + messageLength;

    if (inputBuffer.length >= messageEnd) {
      const messageContent = inputBuffer.slice(4, messageEnd).toString('utf-8');
      inputBuffer = inputBuffer.slice(messageEnd); // Consume message

      try {
        const message = JSON.parse(messageContent);
        handleMessage(message);
      } catch (err) {
        logError(`Failed to parse message JSON: ${err.message}. Content: "${messageContent}"`);
        sendMessage({ error: 'Failed to parse incoming JSON message.' });
      }
    } else {
      break; // Wait for more data
    }
  }
}

// --- Host Logic ---
function handleMessage(message) {
  try {
    // Load config on every message to ensure it's fresh.
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch (err) {
    logError(`Failed to load config file at ${CONFIG_PATH}: ${err.message}`);
    sendMessage({ error: `Host config file not found or corrupt.` });
    return;
  }

  const { hostName, payload } = message;
  
  if (!hostName || !payload) {
    const err = `Invalid message format. 'hostName' and 'payload' are required.`;
    logError(err);
    sendMessage({ error: err });
    return;
  }

  const hostConfig = config[hostName];

  if (!hostConfig) {
    const err = `No host registered with name: ${hostName}`;
    logError(err);
    sendMessage({ error: err });
    return;
  }

  const { scriptPath, interpreter } = hostConfig;

  if (!fs.existsSync(scriptPath)) {
    const err = `Script path not found for host ${hostName}: ${scriptPath}`;
    logError(err);
    sendMessage({ error: err });
    return;
  }

  let child;
  try {
    if (interpreter) {
      child = spawn(interpreter, [scriptPath]);
    } else {
      // If no interpreter, assume the script is directly executable
      child = spawn(scriptPath);
    }
  } catch (spawnErr) {
    logError(`Failed to spawn process: ${spawnErr.message}`);
    sendMessage({ error: `Failed to spawn ${interpreter || scriptPath}: ${spawnErr.message}` });
    return;
  }


  // --- Process Communication ---
  let output = '';
  let errorOutput = '';

  child.stdout.on('data', (data) => {
    output += data.toString();
  });

  child.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  child.on('close', (code) => {
    if (code !== 0) {
      logError(`Script ${scriptPath} exited with code ${code}: ${errorOutput}`);
      sendMessage({ error: `Script execution failed: ${errorOutput}` });
      return;
    }
    
    try {
      // Assume the script's stdout is a JSON object
      const response = JSON.parse(output);
      sendMessage(response);
    } catch (err) {
      // If not JSON, just send as raw text
      sendMessage({ response: output });
    }
  });

  child.on('error', (err) => {
    logError(`Failed to start script ${scriptPath}: ${err.message}`);
    sendMessage({ error: `Failed to start script: ${err.message}` });
  });

  // Send the payload from the extension to the script's stdin
  try {
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  } catch (err) {
    logError(`Failed to write to script stdin: ${err.message}`);
  }
}

// Startup log
logError('AgentBridge Generic Host started.');
