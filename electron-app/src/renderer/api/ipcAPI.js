// ipcAPI.js - Centralized IPC API for renderer process
// This file provides easy-to-use functions for the renderer to communicate with main process

/**
 * Campaign Operations
 */
export const campaignAPI = {
  // Get all campaigns for a user
  async getUserCampaigns(userEmail) {
    return await window.electronAPI.invoke('get-user-campaigns', userEmail);
  },

  // Create a new campaign
  async createCampaign(userEmail, campaignData) {
    return await window.electronAPI.invoke('create-campaign', userEmail, campaignData);
  },

  // Get a specific campaign
  async getCampaign(userEmail, campaignId) {
    return await window.electronAPI.invoke('get-campaign', userEmail, campaignId);
  },

  // Update a campaign
  async updateCampaign(userEmail, campaignId, updateData) {
    return await window.electronAPI.invoke('update-campaign', userEmail, campaignId, updateData);
  },

  // Delete a campaign
  async deleteCampaign(userEmail, campaignId) {
    return await window.electronAPI.invoke('delete-campaign', userEmail, campaignId);
  },

  // Start/Stop a campaign
  async toggleCampaign(userEmail, campaignId, isActive) {
    return await window.electronAPI.invoke('toggle-campaign', userEmail, campaignId, isActive);
  },

  // Get campaign analytics
  async getCampaignAnalytics(userEmail, campaignId) {
    return await window.electronAPI.invoke('get-campaign-analytics', userEmail, campaignId);
  }
};

/**
 * Analytics Operations
 */
export const analyticsAPI = {
  // Get analytics overview
  async getOverview(userEmail, campaignIds = null) {
    return await window.electronAPI.invoke('get-analytics-overview', userEmail, campaignIds);
  },

  // Get live sessions
  async getLiveSessions(userEmail, limit = 10) {
    return await window.electronAPI.invoke('get-live-sessions', userEmail, limit);
  },

  // Get dashboard analytics
  async getDashboardAnalytics(userEmail) {
    return await window.electronAPI.invoke('get-dashboard-analytics', userEmail);
  },

  // Refresh dashboard analytics
  async refreshDashboardAnalytics(userEmail) {
    return await window.electronAPI.invoke('refresh-dashboard-analytics', userEmail);
  },

  // Get traffic sources
  async getTrafficSources(userEmail, campaignIds = null) {
    return await window.electronAPI.invoke('get-traffic-sources', userEmail, campaignIds);
  },

  // Get time series data
  async getTimeSeriesData(userEmail, timeRange = '7d', campaignIds = null) {
    return await window.electronAPI.invoke('get-timeseries-data', userEmail, timeRange, campaignIds);
  },

  // Get campaign performance
  async getCampaignPerformance(userEmail, campaignId) {
    return await window.electronAPI.invoke('get-campaign-performance', userEmail, campaignId);
  },

  // Get user statistics
  async getUserStats(userEmail) {
    return await window.electronAPI.invoke('get-user-stats', userEmail);
  },

  // Export analytics data
  async exportAnalyticsData(userEmail, format = 'json', campaignIds = null) {
    return await window.electronAPI.invoke('export-analytics-data', userEmail, format, campaignIds);
  }
};

/**
 * User Operations
 */
export const userAPI = {
  // Authenticate user
  async authenticate(email, password) {
    return await window.electronAPI.invoke('authenticate-user', email, password);
  },

  // Get user profile
  async getProfile(userEmail) {
    return await window.electronAPI.invoke('get-user-profile', userEmail);
  },

  // Update user profile
  async updateProfile(userEmail, updateData) {
    return await window.electronAPI.invoke('update-user-profile', userEmail, updateData);
  },

  // Change password
  async changePassword(userEmail, currentPassword, newPassword) {
    return await window.electronAPI.invoke('change-password', userEmail, currentPassword, newPassword);
  },

  // Get user log statistics
  async getLogStats(userEmail) {
    return await window.electronAPI.invoke('get-user-log-stats', userEmail);
  },

  // Get user global logs
  async getGlobalLogs(userEmail, limit = 100) {
    return await window.electronAPI.invoke('get-user-global-logs', userEmail, limit);
  },

  // Clear user logs
  async clearLogs(userEmail) {
    return await window.electronAPI.invoke('clear-user-logs', userEmail);
  }
};

/**
 * Logging Operations
 */
export const loggingAPI = {
  // Get campaign logs
  async getCampaignLogs(campaignId, userEmail, limit = 100) {
    return await window.electronAPI.invoke('get-campaign-logs', campaignId, userEmail, limit);
  },

  // Clear campaign logs
  async clearCampaignLogs(campaignId, userEmail) {
    return await window.electronAPI.invoke('clear-campaign-logs', campaignId, userEmail);
  },

  // Get campaign log count
  async getCampaignLogCount(campaignId, userEmail) {
    return await window.electronAPI.invoke('get-campaign-log-count', campaignId, userEmail);
  },

  // Initialize campaign logs
  async initializeCampaignLogs(campaignId) {
    return await window.electronAPI.invoke('initialize-campaign-logs', campaignId);
  },

  // Get system logs
  async getSystemLogs(limit = 50) {
    return await window.electronAPI.invoke('get-system-logs', limit);
  },

  // Check log database health
  async checkLogDbHealth() {
    return await window.electronAPI.invoke('check-log-db-health');
  },

  // Log from renderer
  async logFromRenderer(campaignId, userEmail, logEntry) {
    return await window.electronAPI.invoke('log-from-renderer', campaignId, userEmail, logEntry);
  },

  // Get log hub statistics
  async getLogHubStats() {
    return await window.electronAPI.invoke('get-log-hub-stats');
  },

  // Export campaign logs
  async exportCampaignLogs(campaignId, userEmail, format = 'csv') {
    return await window.electronAPI.invoke('export-campaign-logs', campaignId, userEmail, format);
  },

  // Get log statistics
  async getLogStatistics(campaignId, userEmail) {
    return await window.electronAPI.invoke('get-log-statistics', campaignId, userEmail);
  },

  // Register for log updates
  registerForLogs() {
    window.electronAPI.send('register-for-logs');
  }
};

/**
 * Traffic Operations
 */
export const trafficAPI = {
  // Start campaign traffic
  async startCampaignTraffic(userEmail, campaignId) {
    return await window.electronAPI.invoke('start-campaign-traffic', userEmail, campaignId);
  },

  // Stop campaign traffic
  async stopCampaignTraffic(userEmail, campaignId) {
    return await window.electronAPI.invoke('stop-campaign-traffic', userEmail, campaignId);
  },

  // Get traffic status
  async getTrafficStatus(userEmail, campaignId) {
    return await window.electronAPI.invoke('get-traffic-status', userEmail, campaignId);
  },

  // Get active traffic campaigns
  async getActiveTrafficCampaigns(userEmail) {
    return await window.electronAPI.invoke('get-active-traffic-campaigns', userEmail);
  },

  // Pause/Resume traffic
  async pauseResumeTraffic(userEmail, campaignId, isPaused) {
    return await window.electronAPI.invoke('pause-resume-traffic', userEmail, campaignId, isPaused);
  },

  // Get traffic session details
  async getTrafficSessionDetails(userEmail, campaignId, sessionId) {
    return await window.electronAPI.invoke('get-traffic-session-details', userEmail, campaignId, sessionId);
  }
};

/**
 * System Operations
 */
export const systemAPI = {
  // Get app health status
  async getAppHealth() {
    return await window.electronAPI.invoke('get-app-health');
  },

  // Restart services (for development)
  async restartServices() {
    return await window.electronAPI.invoke('restart-services');
  }
};

/**
 * Event Listeners
 */
export const eventAPI = {
  // Listen for log updates
  onLogUpdate(callback) {
    window.electronAPI.on('log-update', callback);
  },

  // Remove log update listener
  removeLogUpdateListener(callback) {
    window.electronAPI.removeListener('log-update', callback);
  },

  // Listen for traffic logs
  onTrafficLog(callback) {
    window.electronAPI.on('traffic-log', callback);
  },

  // Remove traffic log listener
  removeTrafficLogListener(callback) {
    window.electronAPI.removeListener('traffic-log', callback);
  },

  // Listen for analytics broadcasts
  onAnalyticsBroadcast(callback) {
    window.electronAPI.on('analytics-broadcast', callback);
  },

  // Remove analytics broadcast listener
  removeAnalyticsBroadcastListener(callback) {
    window.electronAPI.removeListener('analytics-broadcast', callback);
  }
};

/**
 * Window Controls
 */
export const windowAPI = {
  minimize() {
    window.electronAPI.send('window-minimize');
  },

  maximize() {
    window.electronAPI.send('window-maximize');
  },

  close() {
    window.electronAPI.send('window-close');
  }
};

// Export all APIs as a single object for convenience
export const electronAPI = {
  campaign: campaignAPI,
  analytics: analyticsAPI,
  user: userAPI,
  logging: loggingAPI,
  traffic: trafficAPI,
  system: systemAPI,
  events: eventAPI,
  window: windowAPI
};
