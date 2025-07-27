# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Start the application in development mode
npm start

# Build for all platforms
npm run build

# Build for specific platforms
npm run build:win    # Windows (NSIS installer)
npm run build:mac    # macOS (DMG)
npm run build:linux  # Linux (AppImage)
```

Note: This project currently has no formal testing or linting setup configured.

## Architecture Overview

This is an Electron desktop application for debugging ThingsBoard RPC (Remote Procedure Call) interfaces. The app follows a three-page workflow:

1. **Login Page** (`login.html`) - Authenticate with ThingsBoard server
2. **Device Selection** (`device-selection.html`) - Choose target device for RPC operations
3. **RPC Debugging** (`index.html`) - Compose, send, and analyze RPC commands

### Key Architectural Patterns

**Multi-process Electron Structure:**
- Main process (`main.js`) handles window management, IPC communication, and system integration
- Renderer processes handle UI logic with page-specific JavaScript files
- IPC channels used for secure communication between processes

**Modular UI Components:**
- Each page has dedicated CSS/JS files (e.g., `renderer.js`, `device-selection.js`, `login.js`)
- Shared theme management via `theme-manager.js` with persistent dark/light mode
- Bootstrap-based responsive design with custom CSS extensions

**RPC Command System:**
- Template-based commands stored in `templates.json` for common operations
- CodeMirror integration for JSON editing with syntax highlighting and validation
- Request/response logging with file-based persistence for debugging

**Configuration Management:**
- `electron-store` for persistent user preferences and connection settings
- Automatic server connection restoration on app restart
- Theme preferences and window state persistence

### Core Modules

**Main Process (`main.js`):**
- Window lifecycle management with proper cleanup
- IPC handlers for login, device queries, and RPC operations  
- File logging system with automatic log rotation
- Theme and configuration persistence

**RPC Interface (`renderer.js`):**
- Primary debugging interface with request composition
- Real-time response display and error handling
- Template management and custom command creation
- Connection status monitoring and automatic reconnection

**Authentication (`login.js`):**
- JWT token management for ThingsBoard API access
- Server connectivity validation and error handling
- Secure credential storage using electron-store

**Device Management (`device-selection.js`):**
- Device discovery and filtering capabilities
- Pagination support for large device inventories
- Device metadata display and selection workflow

### Data Flow

1. User authenticates via ThingsBoard REST API (`/api/auth/login`)
2. JWT token stored securely and used for subsequent API calls
3. Device list fetched from `/api/tenant/devices` with pagination
4. Selected device used for RPC operations via `/api/rpc/twoway/{deviceId}`
5. All requests/responses logged to files in user data directory

### Build System

Uses `electron-builder` for cross-platform packaging:
- Windows: NSIS installer with custom icon
- macOS: DMG distribution
- Linux: AppImage format
- CI/CD via GitHub Actions for automated builds

### Localization

Interface primarily in Chinese with some English labels. All user-facing strings are inline (no i18n framework currently used).

### File Structure

- `*.html` - Page templates with embedded CSS/JS
- `*.js` - Page-specific logic and main process code
- `templates.json` - Predefined RPC command templates
- `assets/` - Application icons and resources
- `.github/workflows/` - CI/CD configuration