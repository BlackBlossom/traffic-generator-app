// index.js - Main IPC handlers initialization
const { initializeCampaignHandlers } = require('./campaignHandlers');
const { initializeAnalyticsHandlers } = require('./analyticsHandlers');
const { initializeLoggingHandlers } = require('./loggingHandlers');
const { initializeTrafficHandlers } = require('./trafficHandlers');

/**
 * Initialize all IPC handlers
 * Call this function from your main process
 */
function initializeAllIpcHandlers() {
  console.log('🚀 Initializing IPC handlers...');
  
  try {
    // Initialize all handler categories
    initializeCampaignHandlers();
    initializeAnalyticsHandlers();
    initializeLoggingHandlers();
    initializeTrafficHandlers();
    
    console.log('✅ All IPC handlers initialized successfully');
    
    // Log available IPC channels for debugging
    logAvailableChannels();
    
  } catch (error) {
    console.error('❌ Failed to initialize IPC handlers:', error);
    throw error;
  }
}

/**
 * Log all available IPC channels for debugging purposes
 */
function logAvailableChannels() {
  const channels = [
    // Campaign operations
    'get-user-campaigns',
    'create-campaign',
    'get-campaign',
    'update-campaign',
    'delete-campaign',
    'toggle-campaign',
    'get-campaign-analytics',
    
    // Analytics operations
    'get-analytics-overview',
    'get-live-sessions',
    'get-dashboard-analytics',
    'refresh-dashboard-analytics',
    'get-traffic-sources',
    'get-timeseries-data',
    'get-campaign-performance',
    'get-user-stats',
    'export-analytics-data',
    
    // Logging operations
    'get-campaign-logs',
    'clear-campaign-logs',
    'clear-all-logs',
    'get-campaign-log-count',
    'initialize-campaign-logs',
    'get-system-logs',
    'check-log-db-health',
    'log-from-renderer',
    'get-log-hub-stats',
    'export-campaign-logs',
    'get-log-statistics',
    
    // Traffic operations
    'start-campaign-traffic',
    'stop-campaign-traffic',
    'get-traffic-status',
    'get-active-traffic-campaigns',
    'pause-resume-traffic',
    'get-traffic-session-details'
  ];
  
  console.log('📡 Available IPC channels:', channels);
}

module.exports = { 
  initializeAllIpcHandlers,
  logAvailableChannels
};
