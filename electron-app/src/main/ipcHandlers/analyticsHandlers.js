// analyticsHandlers.js - IPC handlers for analytics operations
const { ipcMain } = require('electron');
const trafficAnalytics = require('../services/trafficAnalytics');
const dashboardAnalytics = require('../services/dashboardAnalytics');
const campaignAnalytics = require('../services/campaignAnalytics');
const User = require('../models/User');

/**
 * Initialize all analytics-related IPC handlers
 */
function initializeAnalyticsHandlers() {
  
  // Get traffic analytics overview
  ipcMain.handle('get-analytics-overview', async (event, userEmail, campaignIds = null) => {
    try {
      console.log(`🔍 Getting analytics overview for user: ${userEmail}`);
      const analyticsData = await trafficAnalytics.getAnalyticsData(campaignIds, userEmail);
      console.log(`📊 Analytics data retrieved:`, analyticsData ? 'Success' : 'Empty');
      return { success: true, data: analyticsData };
    } catch (error) {
      console.error('❌ get-analytics-overview error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get live session activity
  ipcMain.handle('get-live-sessions', async (event, userEmail, limit = 10) => {
    try {
      console.log(`🔍 Getting live sessions for user: ${userEmail}, limit: ${limit}`);
      const liveSessions = await trafficAnalytics.getLiveSessionActivity(limit, userEmail);
      console.log(`📊 Live sessions retrieved:`, liveSessions ? liveSessions.length : 0, 'sessions');
      return { success: true, data: liveSessions };
    } catch (error) {
      console.error('❌ get-live-sessions error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get session history
  ipcMain.handle('get-session-history', async (event, userEmail, limit = 50) => {
    try {
      const sessionHistory = await trafficAnalytics.getSessionHistory(limit, userEmail);
      return { success: true, data: sessionHistory };
    } catch (error) {
      console.error('❌ get-session-history error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get dashboard analytics
  ipcMain.handle('get-dashboard-analytics', async (event, userEmail) => {
    try {
      const analytics = await dashboardAnalytics.getDashboardAnalytics(userEmail);
      return { success: true, data: analytics };
    } catch (error) {
      console.log('❌ get-dashboard-analytics error:', error);
      console.error('❌ get-dashboard-analytics error:', error);
      return { success: false, error: error.message };
    }
  });

  // Refresh dashboard analytics
  ipcMain.handle('refresh-dashboard-analytics', async (event, userEmail) => {
    try {
      const analytics = await dashboardAnalytics.getDashboardAnalytics(userEmail);
      console.log('✅ Dashboard analytics refreshed successfully');
      return { 
        success: true, 
        data: analytics,
        message: 'Dashboard analytics refreshed successfully'
      };
    } catch (error) {
      console.error('❌ refresh-dashboard-analytics error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get traffic sources data
  ipcMain.handle('get-traffic-sources', async (event, userEmail, campaignIds = null) => {
    try {
      const sourcesData = await trafficAnalytics.getTrafficSources(campaignIds, userEmail);
      console.log('✅ Traffic sources data retrieved successfully');
      return { success: true, data: sourcesData };
    } catch (error) {
      console.error('❌ get-traffic-sources error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get time-series analytics data
  ipcMain.handle('get-timeseries-data', async (event, userEmail, timeRange = '7d', campaignIds = null) => {
    try {
      const timeSeriesData = await trafficAnalytics.getTimeSeriesData(timeRange, campaignIds, userEmail);
      return { success: true, data: timeSeriesData };
    } catch (error) {
      console.error('❌ get-timeseries-data error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get campaign performance metrics
  ipcMain.handle('get-campaign-performance', async (event, userEmail, campaignId) => {
    try {
      const performance = await campaignAnalytics.getCampaignPerformance(campaignId, userEmail);
      return { success: true, data: performance };
    } catch (error) {
      console.error('❌ get-campaign-performance error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get user statistics
  ipcMain.handle('get-user-stats', async (event, userEmail) => {
    try {
      // Get analytics data which has the proper stats structure
      const analyticsData = await trafficAnalytics.getAnalyticsData(null, userEmail);
      
      if (!analyticsData || !analyticsData.overview) {
        // Return empty stats if no data
        return { 
          success: true, 
          data: {
            online: 0,
            total: 0,
            totalVisits: 0,
            avgDuration: 0,
            mobile: 0,
            desktop: 0,
            completed: 0,
            bounced: 0
          }
        };
      }

      const overview = analyticsData.overview;
      
      // Map the analytics data to the expected stats format
      const stats = {
        online: overview.activeSessions || 0,
        total: overview.totalSessions || overview.totalVisits || 0,
        totalVisits: overview.totalVisits || overview.totalSessions || 0,
        avgDuration: overview.avgDuration || 0,
        mobile: overview.mobileCount || 0,
        desktop: overview.desktopCount || 0,
        completed: overview.completedSessions || 0,
        bounced: overview.bouncedSessions || 0,
        efficiency: overview.efficiency || 0,
        bounceRate: overview.bounceRate || 0
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ get-user-stats error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get analytics export data
  ipcMain.handle('export-analytics-data', async (event, userEmail, format = 'json', campaignIds = null) => {
    try {
      const analyticsData = await trafficAnalytics.getAnalyticsData(campaignIds, userEmail);
      
      if (format === 'csv') {
        // Convert to CSV format (simplified example)
        const csvData = await trafficAnalytics.convertToCSV(analyticsData);
        return { success: true, data: csvData, format: 'csv' };
      }
      
      return { success: true, data: analyticsData, format: 'json' };
    } catch (error) {
      console.error('❌ export-analytics-data error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Analytics IPC handlers initialized');
}

module.exports = { initializeAnalyticsHandlers };
