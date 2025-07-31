# Traffic Generator IPC Logging Migration

## Overview

Successfully migrated from WebSocket-based logging to **Electron IPC + EventEmitter pattern** for live log streaming. This provides better performance, security, and reliability for your Electron-based traffic generator application.

## Key Changes Made

### 1. **Log Event Hub System** (`logEventHub.js`)
- **Purpose**: Central hub for managing log broadcasting across all renderer windows
- **Features**: 
  - Window registration and cleanup
  - Real-time log broadcasting via IPC
  - IndexedDB storage integration
  - System-wide and campaign-specific logging

### 2. **Updated Main Process** (`main.js`)
- **Added**: Log event hub integration
- **Added**: IPC handlers for log operations:
  - `register-for-logs` - Register window for live updates
  - `get-logs` - Fetch stored logs
  - `clear-logs` - Clear campaign logs
  - `get-log-count` - Get log counts
  - `log-from-renderer` - Log from renderer process

### 3. **Enhanced Preload Script** (`preload.js`)
- **Added**: Complete logging API exposure to renderer:
  - `registerForLogs()` - Register for live updates
  - `onLogUpdate()` - Listen for log events
  - `getLogs()` - Fetch logs
  - `clearLogs()` - Clear logs
  - `logFromRenderer()` - Log from renderer

### 4. **Updated Traffic Worker** (`traffic.js`)
- **Removed**: WebSocket dependency (`ws` parameter)
- **Added**: IPC-based logging via `logToIPC()` function
- **Improved**: Better error handling and performance
- **Maintained**: All existing functionality (cookies, clicks, scrolling, analytics)

### 5. **IPC Logger Service** (`ipcLogger.js`)
- **Purpose**: Utility service for easy logging from any main process module
- **Features**:
  - Convenience methods for different log levels
  - Scoped loggers for specific campaigns/users
  - Batch logging capabilities
  - System-wide logging

### 6. **React Log Viewer Component** (`LogViewer.jsx`)
- **Purpose**: Live log display component for renderer processes
- **Features**:
  - Real-time log streaming
  - Auto-scroll and manual scroll controls
  - Log level color coding
  - Connection status indicator
  - Log clearing functionality

## Usage Examples

### 1. **Using Traffic Worker (Main Process)**

```javascript
const { runTraffic } = require('./traffic-worker/traffic');

// Run traffic without WebSocket parameter
await runTraffic(
  trafficParams,
  campaignId,    // Campaign ID for log context
  userEmail      // User email for log context
);
```

### 2. **Using IPC Logger in Main Process**

```javascript
const ipcLogger = require('./services/ipcLogger');

// Log for specific campaign session
await ipcLogger.logSession('campaign-123', 'user@example.com', 'session-abc', 'info', 'Session started');

// Create scoped logger
const scopedLogger = ipcLogger.createScopedLogger('campaign-123', 'user@example.com');
await scopedLogger.info('Session completed successfully', 'session-abc');

// System-wide logging
await ipcLogger.systemInfo('Application started');
```

### 3. **Using Log Viewer in React Component**

```jsx
import LogViewer from '../components/LogViewer';

function TrafficDashboard() {
  return (
    <div style={{ height: '400px' }}>
      <LogViewer 
        campaignId="campaign-123"
        userEmail="user@example.com"
        maxLogs={1000}
        autoScroll={true}
      />
    </div>
  );
}
```

### 4. **Logging from Renderer Process**

```javascript
// In React component or renderer JavaScript
const logMessage = async (message, level = 'info') => {
  await window.electronAPI.logFromRenderer('campaign-123', 'user@example.com', {
    level,
    message,
    sessionId: 'renderer-ui',
    timestamp: new Date().toISOString()
  });
};

// Usage
await logMessage('User clicked start button', 'info');
await logMessage('Configuration error detected', 'error');
```

## Migration Benefits

### 🚀 **Performance Improvements**
- **No network overhead** - Direct IPC communication
- **Lower latency** - No HTTP/WebSocket handshake delays
- **Memory efficient** - No connection pools or socket management
- **Faster log delivery** - Direct process communication

### 🔒 **Security & Reliability**
- **No external ports** - Everything stays within Electron
- **Process crash resilience** - IPC handles reconnection automatically
- **No firewall issues** - No network involvement
- **Automatic cleanup** - Windows are garbage collected properly

### ⚡ **Electron-Native Features**
- **Process isolation** - Main and renderer processes stay separated
- **Built-in serialization** - Handles complex objects automatically
- **Multiple window support** - Broadcast to all renderer windows
- **DevTools integration** - Easy debugging of IPC messages

### 📊 **Enhanced Functionality**
- **IndexedDB persistence** - Logs stored locally with expiration
- **Structured logging** - Better log organization and filtering
- **Real-time streaming** - Immediate log delivery to UI
- **Batch operations** - Efficient handling of multiple logs

## API Reference

### **Main Process APIs**

```javascript
// Log Event Hub
const logEventHub = require('./services/logEventHub');
await logEventHub.logTrafficSession(campaignId, userEmail, sessionId, level, message);
await logEventHub.logFromMain(campaignId, userEmail, message, level, sessionId);
await logEventHub.logSystem(message, level);

// IPC Logger (Recommended)
const ipcLogger = require('./services/ipcLogger');
await ipcLogger.logSession(campaignId, userEmail, sessionId, level, message);
await ipcLogger.logCampaign(campaignId, userEmail, message, level, sessionId);
await ipcLogger.logSystem(message, level);
```

### **Renderer Process APIs**

```javascript
// Registration and listeners
window.electronAPI.registerForLogs();
const unsubscribe = window.electronAPI.onLogUpdate(callback);

// Log operations
await window.electronAPI.getLogs(campaignId, userEmail, limit);
await window.electronAPI.clearLogs(campaignId, userEmail);
await window.electronAPI.getLogCount(campaignId, userEmail);

// Logging from renderer
await window.electronAPI.logFromRenderer(campaignId, userEmail, logEntry);
```

## Integration with Existing Code

### **Traffic Settings Integration**
Your existing TrafficSettings.jsx can now integrate live logging:

```jsx
import LogViewer from '../components/LogViewer';

// Add to your campaign monitoring section
<LogViewer 
  campaignId={activeCampaign.id}
  userEmail={user.email}
  maxLogs={500}
  autoScroll={true}
/>
```

### **Debug Page Enhancement**
Update your DebugPage.jsx to use the new logging system:

```jsx
// Replace WebSocket connections with IPC logging
useEffect(() => {
  window.electronAPI.registerForLogs();
  
  const unsubscribe = window.electronAPI.onLogUpdate((logData) => {
    // Handle incoming logs
    setLogs(prev => [logData, ...prev]);
  });
  
  return unsubscribe;
}, []);
```

## Troubleshooting

### **Connection Issues**
- Ensure `window.electronAPI.registerForLogs()` is called before listening
- Check that the main process is properly initialized
- Verify IndexedDB is working in renderer process

### **Missing Logs**
- Confirm campaign ID and user email are correct
- Check that traffic worker is using the updated `runTraffic` function
- Verify IndexedDB storage is not full or corrupted

### **Performance Issues**
- Limit `maxLogs` in LogViewer component (default: 1000)
- Use log level filtering to reduce noise
- Consider using scoped loggers for better organization

## Next Steps

1. **Test the system** with a sample traffic campaign
2. **Update existing components** to use the new LogViewer
3. **Replace WebSocket references** in other parts of your application
4. **Monitor performance** and adjust log retention settings as needed

The migration is complete and your traffic generator now uses a more efficient, secure, and reliable logging system powered by Electron's native IPC capabilities!
