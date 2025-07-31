// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── IPC COMMUNICATION ─────────────────────────────────────────
  
  // Generic invoke method for IPC calls
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // Generic send method for one-way IPC calls
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  
  // Generic event listener
  on: (channel, callback) => {
    const listener = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, listener);
    return listener;
  },
  
  // Remove event listener
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  },

  // ─── WINDOW CONTROLS ─────────────────────────────────────────
  
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // ─── CAMPAIGN OPERATIONS ─────────────────────────────────────────
  
  getUserCampaigns: (userEmail) => 
    ipcRenderer.invoke('get-user-campaigns', userEmail),
  
  createCampaign: (userEmail, campaignData) => 
    ipcRenderer.invoke('create-campaign', userEmail, campaignData),
  
  getCampaign: (userEmail, campaignId) => 
    ipcRenderer.invoke('get-campaign', userEmail, campaignId),
  
  updateCampaign: (userEmail, campaignId, updateData) => 
    ipcRenderer.invoke('update-campaign', userEmail, campaignId, updateData),
  
  deleteCampaign: (userEmail, campaignId) => 
    ipcRenderer.invoke('delete-campaign', userEmail, campaignId),
  
  toggleCampaign: (userEmail, campaignId, isActive) => 
    ipcRenderer.invoke('toggle-campaign', userEmail, campaignId, isActive),
  
  getCampaignAnalytics: (userEmail, campaignId) => 
    ipcRenderer.invoke('get-campaign-analytics', userEmail, campaignId),

  // ─── ANALYTICS OPERATIONS ─────────────────────────────────────────
  
  getAnalyticsOverview: (userEmail, campaignIds) => 
    ipcRenderer.invoke('get-analytics-overview', userEmail, campaignIds),
  
  getLiveSessions: (userEmail, limit) => 
    ipcRenderer.invoke('get-live-sessions', userEmail, limit),
  
  getDashboardAnalytics: (userEmail) => 
    ipcRenderer.invoke('get-dashboard-analytics', userEmail),
  
  refreshDashboardAnalytics: (userEmail) => 
    ipcRenderer.invoke('refresh-dashboard-analytics', userEmail),
  
  getTrafficSources: (userEmail, campaignIds) => 
    ipcRenderer.invoke('get-traffic-sources', userEmail, campaignIds),
  
  getTimeSeriesData: (userEmail, timeRange, campaignIds) => 
    ipcRenderer.invoke('get-timeseries-data', userEmail, timeRange, campaignIds),
  
  getCampaignPerformance: (userEmail, campaignId) => 
    ipcRenderer.invoke('get-campaign-performance', userEmail, campaignId),
  
  getUserStats: (userEmail) => 
    ipcRenderer.invoke('get-user-stats', userEmail),
  
  exportAnalyticsData: (userEmail, format, campaignIds) => 
    ipcRenderer.invoke('export-analytics-data', userEmail, format, campaignIds),

  // ─── USER OPERATIONS ─────────────────────────────────────────
  
  getUserLogStats: (userEmail) => 
    ipcRenderer.invoke('get-user-log-stats', userEmail),
  
  getUserGlobalLogs: (userEmail, limit) => 
    ipcRenderer.invoke('get-user-global-logs', userEmail, limit),
  
  clearUserLogs: (userEmail) => 
    ipcRenderer.invoke('clear-user-logs', userEmail),

  // ─── LOGGING OPERATIONS ─────────────────────────────────────────
  
  registerForLogs: () => ipcRenderer.send('register-for-logs'),
  
  getCampaignLogs: (campaignId, userEmail, limit) => 
    ipcRenderer.invoke('get-campaign-logs', campaignId, userEmail, limit),
  
  clearCampaignLogs: (campaignId, userEmail) => 
    ipcRenderer.invoke('clear-campaign-logs', campaignId, userEmail),
  
  clearAllLogs: () => 
    ipcRenderer.invoke('clear-all-logs'),
  
  getCampaignLogCount: (campaignId, userEmail) => 
    ipcRenderer.invoke('get-campaign-log-count', campaignId, userEmail),
  
  initializeCampaignLogs: (campaignId) => 
    ipcRenderer.invoke('initialize-campaign-logs', campaignId),
  
  getSystemLogs: (limit) => 
    ipcRenderer.invoke('get-system-logs', limit),
  
  checkLogDbHealth: () => 
    ipcRenderer.invoke('check-log-db-health'),
  
  logFromRenderer: (campaignId, userEmail, logEntry) => 
    ipcRenderer.invoke('log-from-renderer', campaignId, userEmail, logEntry),
  
  getLogHubStats: () => 
    ipcRenderer.invoke('get-log-hub-stats'),
  
  exportCampaignLogs: (campaignId, userEmail, format) => 
    ipcRenderer.invoke('export-campaign-logs', campaignId, userEmail, format),
  
  getLogStatistics: (campaignId, userEmail) => 
    ipcRenderer.invoke('get-log-statistics', campaignId, userEmail),

  // ✅ NEW: Live Log Integration Methods
  getLogs: (campaignId, userEmail, limit) => 
    ipcRenderer.invoke('get-logs', campaignId, userEmail, limit),
  
  clearLogs: (campaignId, userEmail) => 
    ipcRenderer.invoke('clear-logs', campaignId, userEmail),
  
  testLog: (campaignId, userEmail) => 
    ipcRenderer.invoke('test-log', campaignId, userEmail),
  
  // Listen for live log updates
  onLogUpdate: (callback) => {
    const subscription = (event, data) => callback(data);
    ipcRenderer.on('log-update', subscription);
    return () => ipcRenderer.removeListener('log-update', subscription);
  },

  // ─── TRAFFIC OPERATIONS ─────────────────────────────────────────
  
  startCampaignTraffic: (userEmail, campaignId) => 
    ipcRenderer.invoke('start-campaign-traffic', userEmail, campaignId),
  
  stopCampaignTraffic: (userEmail, campaignId) => 
    ipcRenderer.invoke('stop-campaign-traffic', userEmail, campaignId),
  
  getTrafficStatus: (userEmail, campaignId) => 
    ipcRenderer.invoke('get-traffic-status', userEmail, campaignId),
  
  getActiveTrafficCampaigns: (userEmail) => 
    ipcRenderer.invoke('get-active-traffic-campaigns', userEmail),
  
  pauseResumeTraffic: (userEmail, campaignId, isPaused) => 
    ipcRenderer.invoke('pause-resume-traffic', userEmail, campaignId, isPaused),
  
  getTrafficSessionDetails: (userEmail, campaignId, limit = 10) => 
    ipcRenderer.invoke('get-traffic-session-details', userEmail, campaignId, limit),

  // ─── SYSTEM OPERATIONS ─────────────────────────────────────────
  
  getAppHealth: () => 
    ipcRenderer.invoke('get-app-health'),
  
  restartServices: () => 
    ipcRenderer.invoke('restart-services'),

  // ─── AUTO-LAUNCH OPERATIONS ─────────────────────────────────────────
  
  getStartupEnabled: () => 
    ipcRenderer.invoke('get-startup-enabled'),
  
  setStartupEnabled: (enable) => 
    ipcRenderer.invoke('set-startup-enabled', enable),

  // ─── EVENT LISTENERS ─────────────────────────────────────────
  
  // Listen for traffic logs
  onTrafficLog: (callback) => {
    const listener = (event, logData) => callback(logData);
    ipcRenderer.on('traffic-log', listener);
    return () => ipcRenderer.removeListener('traffic-log', listener);
  },
  
  // Listen for analytics broadcasts
  onAnalyticsBroadcast: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('analytics-broadcast', listener);
    return () => ipcRenderer.removeListener('analytics-broadcast', listener);
  },
  
  // Listen for system log updates
  onSystemLogUpdate: (callback) => {
    const listener = (event, logData) => callback(logData);
    ipcRenderer.on('system-log-update', listener);
    return () => ipcRenderer.removeListener('system-log-update', listener);
  }
});
