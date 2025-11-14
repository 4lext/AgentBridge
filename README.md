# AgentBridge

A standalone open-source utility to securely install, manage, and debug Chrome Native Messaging hosts.

## The Problem

The Chrome Native Messaging API is powerful, enabling browser extensions to communicate with native applications on the user's computer. However, it has a high barrier to entry:

- **Manual Manifest Creation**: Developers must manually create JSON manifest files with precise formatting
- **Platform-Specific Installation**: 
  - Windows: Registry key creation and management
  - macOS: Specific directory placement (`~/Library/Application Support/...`)
  - Linux: Configuration in `~/.config/` or system directories
- **Difficult Debugging**: No built-in tools to test or debug native messaging connections
- **Error-Prone Setup**: One typo in manifest files or paths breaks the entire connection

## The Solution

AgentBridge is an Electron-based desktop application that provides a simple, user-friendly GUI to:

- ✅ Register local scripts (Node.js, Python, etc.) as native messaging hosts
- ✅ Automatically generate proper manifest files
- ✅ Handle all platform-specific configuration (Registry, directories, permissions)
- ✅ Test and debug native messaging connections
- ✅ Manage multiple native hosts from a single interface

## Features

### Core Features (MVP)

- **Simple Registration**: Point-and-click interface to register any script as a native host
- **Manifest Management**: Automatic generation and validation of manifest files
- **Platform Compatibility**: Works seamlessly on Windows, macOS, and Linux
- **Security**: Validates extension IDs and follows Chrome's security best practices
- **Host Management**: View, edit, and remove registered native hosts
- **Testing Tools**: Built-in message testing to verify host communication

### Planned Features

- Real-time message logging and debugging
- Template library for common host patterns
- Extension ID verification
- Automatic host updates
- Multi-browser support (Firefox, Edge)

## Installation

### Prerequisites

- Chrome or Chromium-based browser
- Node.js 16+ (for running the application)

### Download

Download the latest release for your platform:

- **Windows**: `AgentBridge-Setup-x.x.x.exe`
- **macOS**: `AgentBridge-x.x.x.dmg`
- **Linux**: `AgentBridge-x.x.x.AppImage`

### Build from Source

```bash
# Clone the repository
git clone https://github.com/4lext/AgentBridge.git
cd AgentBridge

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Usage

### Registering a Native Host

1. **Launch AgentBridge** and click "Add New Host"

2. **Configure your host**:
   - **Name**: A unique identifier (e.g., `com.mycompany.myhost`)
   - **Description**: What your native host does
   - **Path**: Location of your executable/script
   - **Type**: Script type (Node.js, Python, Binary, etc.)
   - **Extension IDs**: Chrome extension IDs allowed to connect

3. **Click "Register"** - AgentBridge will:
   - Generate the manifest file
   - Install it to the correct platform location
   - Update Registry (Windows) or create symlinks (macOS/Linux)
   - Validate the installation

4. **Test the connection** using the built-in testing tool

### Example: Registering a Node.js Script

```javascript
// my-native-host.js
#!/usr/bin/env node

// Read message length (4 bytes)
const stdin = process.stdin;
const stdout = process.stdout;

stdin.on('readable', () => {
  const chunk = stdin.read();
  if (chunk !== null) {
    // Process the message from the extension
    const message = JSON.parse(chunk.toString());
    
    // Send response back to extension
    const response = { received: message, timestamp: Date.now() };
    const buffer = Buffer.from(JSON.stringify(response));
    
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    
    stdout.write(header);
    stdout.write(buffer);
  }
});
```

Register this script in AgentBridge with:
- **Name**: `com.example.mynativehost`
- **Path**: `/path/to/my-native-host.js`
- **Type**: Node.js

### Testing Your Native Host

1. Select your registered host from the list
2. Click "Test Connection"
3. Send a test message: `{"action": "ping"}`
4. View the response in real-time
5. Check logs for any errors or warnings

## Technical Details

### Native Messaging Protocol

Native Messaging uses a simple protocol:
- Messages are exchanged in JSON format
- Each message is preceded by a 4-byte length header (32-bit integer, native byte order)
- The host reads from stdin and writes to stdout

### Manifest File Structure

```json
{
  "name": "com.example.host",
  "description": "My Native Messaging Host",
  "path": "/path/to/host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://extensionid/"
  ]
}
```

### Platform-Specific Locations

**Windows**:
- Manifest: `%USERPROFILE%\.config\AgentBridge\hosts\`
- Registry: `HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\`

**macOS**:
- Manifest: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`

**Linux**:
- Manifest: `~/.config/google-chrome/NativeMessagingHosts/`

## Development

### Project Structure

```
AgentBridge/
├── src/
│   ├── main/          # Electron main process
│   ├── renderer/      # React UI components
│   ├── platform/      # Platform-specific code
│   └── utils/         # Shared utilities
├── assets/            # Icons, images
├── tests/             # Test suite
└── docs/              # Documentation
```

### Technology Stack

- **Electron**: Cross-platform desktop framework
- **React**: UI framework
- **Node.js**: Backend operations
- **TypeScript**: Type-safe development

### Running Tests

```bash
npm test
```

### Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security Considerations

- **Extension ID Validation**: Only specified extensions can communicate with hosts
- **No Elevated Privileges**: Hosts run with user permissions only
- **Manifest Validation**: All manifests are validated before registration
- **Secure Storage**: Sensitive data is never stored in plain text

## Troubleshooting

### Host Not Appearing in Extension

1. Check that the manifest file exists in the correct location
2. Verify the extension ID is correct in the manifest
3. Restart Chrome after registration
4. Check Chrome's native messaging logs: `chrome://extensions/` → Developer mode → Inspect views

### "Host Disconnected" Error

1. Verify the host script path is correct
2. Check that the script is executable
3. Ensure the script follows the native messaging protocol
4. Review host logs in AgentBridge

### Permission Issues (macOS/Linux)

```bash
# Make script executable
chmod +x /path/to/your/script
```

## Resources

- [Chrome Native Messaging Documentation](https://developer.chrome.com/docs/apps/nativeMessaging/)
- [Native Messaging Protocol](https://developer.chrome.com/docs/extensions/mv3/nativeMessaging/#native-messaging-host-protocol)
- [Example Native Hosts](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/nativeMessaging)

## License

MIT License - see [LICENSE](LICENSE) file for details

## Support

- 🐛 [Report a Bug](https://github.com/4lext/AgentBridge/issues)
- 💡 [Request a Feature](https://github.com/4lext/AgentBridge/issues)
- 💬 [Discussions](https://github.com/4lext/AgentBridge/discussions)

## Acknowledgments

Built with ❤️ by the open-source community to make native messaging accessible to everyone.
