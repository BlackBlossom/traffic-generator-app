# Migration from Express API to IPC Architecture

## Overview
This document outlines the migration from Express-based API routes to Electron IPC (Inter-Process Communication) for the traffic generator application.

## Key Changes

### 1. Architecture Transformation
- **Before**: Express server running inside Electron main process with REST API endpoints
- **After**: Direct IPC communication between main and renderer processes

### 2. File Structure Changes

#### New Files Created:
```
electron-app/src/main/
├── ipcHandlers/
│   ├── index.js                 // Main IPC handlers initialization
│   ├── campaignHandlers.js      // Campaign operations via IPC
│   ├── analyticsHandlers.js     // Analytics operations via IPC
│   ├── userHandlers.js         // User operations via IPC
│   ├── loggingHandlers.js      // Logging operations via IPC
│   └── trafficHandlers.js      // Traffic operations via IPC
├── mainService.js              // Replaces ipcService.js
└── ...

electron-app/src/renderer/api/
└── ipcAPI.js                   // Centralized API for renderer
```

#### Modified Files:
- `main.js` - Updated to use IPC handlers instead of Express
- `preload.js` - Comprehensive IPC method exposure
- `ipcService.js` - To be replaced by `mainService.js`

### 3. API Changes

#### Before (Express Routes):
```javascript
// REST API calls from renderer
fetch('/api/auth/users/${email}/campaigns')
fetch('/api/analytics/${email}/overview')
fetch('/api/dashboard/${email}/analytics')
```

#### After (IPC Calls):
```javascript
// IPC calls from renderer
await window.electronAPI.getUserCampaigns(userEmail)
await window.electronAPI.getAnalyticsOverview(userEmail, campaignIds)
await window.electronAPI.getDashboardAnalytics(userEmail)
```

## Migration Steps

### Step 1: Remove Express Dependencies
The old `ipcService.js` file contained:
- Express server setup
- REST API routes
- WebSocket for real-time communication

This has been replaced with:
- Direct IPC handlers in `mainService.js`
- IPC-based real-time communication

### Step 2: Update Renderer API Calls
Replace all HTTP fetch calls with IPC calls:

```javascript
// Old approach
const response = await fetch(`/api/auth/users/${email}/campaigns`);
const campaigns = await response.json();

// New approach
const result = await window.electronAPI.getUserCampaigns(email);
const campaigns = result.success ? result.data : [];
```

### Step 3: Update Event Handling
Replace WebSocket listeners with IPC event listeners:

```javascript
// Old approach
websocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle log update
};

// New approach
window.electronAPI.onLogUpdate((logData) => {
  // Handle log update
});
```

## IPC Handler Categories

### 1. Campaign Handlers (`campaignHandlers.js`)
- `get-user-campaigns` - Get all campaigns for a user
- `create-campaign` - Create a new campaign
- `get-campaign` - Get specific campaign details
- `update-campaign` - Update campaign information
- `delete-campaign` - Delete a campaign
- `toggle-campaign` - Start/stop a campaign
- `get-campaign-analytics` - Get campaign analytics

### 2. Analytics Handlers (`analyticsHandlers.js`)
- `get-analytics-overview` - Get analytics overview
- `get-live-sessions` - Get live session activity
- `get-dashboard-analytics` - Get dashboard analytics
- `refresh-dashboard-analytics` - Refresh dashboard data
- `get-traffic-sources` - Get traffic source data
- `get-timeseries-data` - Get time-series analytics
- `get-campaign-performance` - Get campaign performance metrics
- `get-user-stats` - Get user statistics
- `export-analytics-data` - Export analytics data

### 3. User Handlers (`userHandlers.js`)
- `authenticate-user` - User authentication
- `get-user-profile` - Get user profile
- `update-user-profile` - Update user profile
- `change-password` - Change user password
- `get-user-log-stats` - Get user log statistics
- `get-user-global-logs` - Get user global logs
- `clear-user-logs` - Clear user logs

### 4. Logging Handlers (`loggingHandlers.js`)
- `get-campaign-logs` - Get logs for specific campaign
- `clear-campaign-logs` - Clear campaign logs
- `get-campaign-log-count` - Get campaign log count
- `initialize-campaign-logs` - Initialize campaign logs
- `get-system-logs` - Get system logs
- `check-log-db-health` - Check logging database health
- `log-from-renderer` - Log from renderer process
- `get-log-hub-stats` - Get log hub statistics
- `export-campaign-logs` - Export campaign logs
- `get-log-statistics` - Get log statistics

### 5. Traffic Handlers (`trafficHandlers.js`)
- `start-campaign-traffic` - Start traffic for campaign
- `stop-campaign-traffic` - Stop traffic for campaign
- `get-traffic-status` - Get traffic status
- `get-active-traffic-campaigns` - Get active traffic campaigns
- `pause-resume-traffic` - Pause/resume traffic
- `get-traffic-session-details` - Get traffic session details

## Benefits of IPC Architecture

### 1. Performance
- Direct process communication (no HTTP overhead)
- Faster data transfer
- Reduced latency

### 2. Security
- No exposed HTTP endpoints
- Direct process communication
- Better sandboxing

### 3. Simplicity
- No need for authentication middleware
- No CORS issues
- Direct JavaScript object passing

### 4. Native Integration
- Better integration with Electron lifecycle
- Native event handling
- Improved error handling

## Usage Examples

### Campaign Operations
```javascript
import { campaignAPI } from './api/ipcAPI.js';

// Get user campaigns
const campaigns = await campaignAPI.getUserCampaigns('user@example.com');

// Create new campaign
const newCampaign = await campaignAPI.createCampaign('user@example.com', {
  name: 'My Campaign',
  totalSessions: 100,
  // ... other campaign data
});

// Start campaign
await campaignAPI.toggleCampaign('user@example.com', campaignId, true);
```

### Analytics Operations
```javascript
import { analyticsAPI } from './api/ipcAPI.js';

// Get dashboard analytics
const analytics = await analyticsAPI.getDashboardAnalytics('user@example.com');

// Get live sessions
const liveSessions = await analyticsAPI.getLiveSessions('user@example.com', 10);
```

### Real-time Events
```javascript
import { eventAPI } from './api/ipcAPI.js';

// Listen for log updates
const unsubscribe = eventAPI.onLogUpdate((logData) => {
  console.log('New log:', logData);
});

// Listen for analytics broadcasts
eventAPI.onAnalyticsBroadcast((data) => {
  console.log('Analytics update:', data);
});
```

## Next Steps

1. **Remove old files**: Delete `routes/`, old `controllers/` if not needed
2. **Update renderer components**: Replace HTTP calls with IPC calls
3. **Test all functionality**: Ensure all features work with IPC
4. **Remove Express dependencies**: Clean up package.json

## Files to Remove/Archive

After migration is complete, these files can be removed:
- `routes/analytics.js`
- `routes/dashboard.js`
- `routes/userRoutes.js`
- `middleware/apiKeyAuth.js` (if not used elsewhere)
- `middleware/errorHandler.js` (if not used elsewhere)

The `ipcService.js` should be replaced entirely by `mainService.js`.
