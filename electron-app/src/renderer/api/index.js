// api/index.js - Central export for all API modules

// Authentication APIs (HTTP-based, unchanged)
export * from './auth.js';

// IPC-based APIs
export { analyticsAPI } from './analytics.js';
export { dashboardAPI } from './dashboard.js';
export { trafficAPI } from './trafficService.js';
export { loggingAPI } from './loggingService.js';

// IPC wrapper (for direct access to campaign operations)
export * from './ipcAPI.js';

// Legacy compatibility (if needed)
export { default as ipcAPI } from './ipcAPI.js';
