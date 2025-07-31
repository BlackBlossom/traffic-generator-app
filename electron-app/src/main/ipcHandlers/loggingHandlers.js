// loggingHandlers.js - IPC handlers for logging operations
const { ipcMain } = require('electron');
const sqliteLogger = require('../services/sqliteLogger');
const logEventHub = require('../services/logEventHub');

/**
 * Initialize all logging-related IPC handlers
 */
function initializeLoggingHandlers() {
  
  // Get user global logs (all logs for a user across all campaigns)
  ipcMain.handle('get-user-global-logs', async (event, userEmail, limit = 100) => {
    try {
      const logs = await sqliteLogger.getUserGlobalLogs(userEmail, limit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('❌ get-user-global-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get logs for a specific campaign
  ipcMain.handle('get-campaign-logs', async (event, campaignId, userEmail, limit = 100) => {
    try {
      const logs = await sqliteLogger.fetchLogs(campaignId, userEmail, limit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('❌ get-campaign-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear logs for a specific campaign
  ipcMain.handle('clear-campaign-logs', async (event, campaignId, userEmail) => {
    try {
      const success = await sqliteLogger.clearLogs(campaignId, userEmail);
      
      if (success) {
        await logEventHub.logFromMain(
          campaignId, 
          userEmail, 
          'Campaign logs cleared by user', 
          'info'
        );
      }

      return { 
        success, 
        message: success ? 'Logs cleared successfully' : 'Failed to clear logs' 
      };
    } catch (error) {
      console.error('❌ clear-campaign-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear ALL logs from the database (system and campaign logs)
  ipcMain.handle('clear-all-logs', async (event) => {
    try {
      const success = await sqliteLogger.clearAllLogs();
      
      if (success) {
        await logEventHub.logSystem('All logs cleared from database by user', 'info');
      }

      return { 
        success, 
        message: success ? 'All logs cleared successfully' : 'Failed to clear all logs' 
      };
    } catch (error) {
      console.error('❌ clear-all-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear all logs for a user
  ipcMain.handle('clear-user-logs', async (event, userEmail) => {
    try {
      // SQLite implementation: delete all logs for the user
      const stmt = sqliteLogger.db.prepare('DELETE FROM campaign_logs WHERE user_email = ?');
      const result = stmt.run(userEmail);
      const success = result.changes > 0;
      
      if (success) {
        await logEventHub.logFromMain(
          null, 
          userEmail, 
          `All user logs cleared by user (${result.changes} logs deleted)`, 
          'info'
        );
      }

      return { 
        success: true, // Always return success even if no logs were found
        message: `${result.changes} user logs cleared successfully` 
      };
    } catch (error) {
      console.error('❌ clear-user-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get user log statistics
  ipcMain.handle('get-user-log-stats', async (event, userEmail) => {
    try {
      const stats = await sqliteLogger.getUserLogStats(userEmail);
      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ get-user-log-stats error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get log count for a campaign
  ipcMain.handle('get-campaign-log-count', async (event, campaignId, userEmail) => {
    try {
      const count = await sqliteLogger.getLogCount(campaignId, userEmail);
      return { success: true, data: count };
    } catch (error) {
      console.error('❌ get-campaign-log-count error:', error);
      return { success: false, error: error.message };
    }
  });

  // Initialize campaign logs
  ipcMain.handle('initialize-campaign-logs', async (event, campaignId) => {
    try {
      const success = await sqliteLogger.initializeCampaignLogs(campaignId);
      return { 
        success, 
        message: success ? 'Campaign logs initialized' : 'Failed to initialize logs' 
      };
    } catch (error) {
      console.error('❌ initialize-campaign-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get system logs
  ipcMain.handle('get-system-logs', async (event, limit = 50) => {
    try {
      const logs = await sqliteLogger.getSystemLogs(limit);
      return { success: true, data: logs };
    } catch (error) {
      console.error('❌ get-system-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Check SQLite health
  ipcMain.handle('check-log-db-health', async (event) => {
    try {
      const health = await sqliteLogger.checkHealth();
      return { success: true, data: health };
    } catch (error) {
      console.error('❌ check-log-db-health error:', error);
      return { success: false, error: error.message };
    }
  });

  // Log from renderer process
  ipcMain.handle('log-from-renderer', async (event, campaignId, userEmail, logEntry) => {
    try {
      await logEventHub.logAndBroadcast(campaignId, userEmail, {
        ...logEntry,
        source: 'renderer',
        timestamp: new Date().toISOString()
      });
      return { success: true };
    } catch (error) {
      console.error('❌ log-from-renderer error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get log hub statistics
  ipcMain.handle('get-log-hub-stats', async (event) => {
    try {
      const stats = logEventHub.getStats();
      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ get-log-hub-stats error:', error);
      return { success: false, error: error.message };
    }
  });

  // Register window for log updates
  ipcMain.on('register-for-logs', (event) => {
    try {
      const { BrowserWindow } = require('electron');
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        logEventHub.addWindow(window);
        console.log('📡 Window registered for log broadcasting');
      }
    } catch (error) {
      console.error('❌ register-for-logs error:', error);
    }
  });

  // Export logs (CSV format)
  ipcMain.handle('export-campaign-logs', async (event, campaignId, userEmail, format = 'csv') => {
    try {
      const logs = await sqliteLogger.fetchLogs(campaignId, userEmail, 10000); // Get all logs
      
      if (format === 'csv') {
        const csvContent = logs.map(log => {
          // Parse the formatted log string back to components
          const match = log.match(/^\[(.*?)\](?:\s*\[(.*?)\])?\s*(.*?):\s*(.*)$/);
          if (match) {
            const [, timestamp, sessionId, level, message] = match;
            return `"${timestamp}","${level}","${message.replace(/"/g, '""')}","${sessionId || ''}"`;
          }
          return `"","","${log.replace(/"/g, '""')}",""`;
        }).join('\n');
        
        const csvHeader = 'Timestamp,Level,Message,Session ID\n';
        return { 
          success: true, 
          data: csvHeader + csvContent,
          format: 'csv',
          count: logs.length
        };
      }
      
      return { 
        success: true, 
        data: logs,
        format: 'json',
        count: logs.length
      };
    } catch (error) {
      console.error('❌ export-campaign-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get log statistics
  ipcMain.handle('get-log-statistics', async (event, campaignId, userEmail) => {
    try {
      const logs = await sqliteLogger.fetchLogs(campaignId, userEmail, 10000);
      
      const stats = {
        total: logs.length,
        byLevel: {
          debug: logs.filter(l => l.includes('DEBUG:')).length,
          info: logs.filter(l => l.includes('INFO:')).length,
          warn: logs.filter(l => l.includes('WARN:')).length,
          error: logs.filter(l => l.includes('ERROR:')).length
        },
        timeRange: {
          earliest: logs.length > 0 ? logs[logs.length - 1].match(/^\[(.*?)\]/)?.[1] : null,
          latest: logs.length > 0 ? logs[0].match(/^\[(.*?)\]/)?.[1] : null
        }
      };

      return { success: true, data: stats };
    } catch (error) {
      console.error('❌ get-log-statistics error:', error);
      return { success: false, error: error.message };
    }
  });

  // Test log creation for debugging
  ipcMain.handle('test-log', async (event, campaignId, userEmail) => {
    try {
      const testLogEntry = {
        level: 'info',
        message: `Test log message created at ${new Date().toISOString()}`,
        sessionId: 'test-session'
      };
      
      console.log('🧪 IPC: Creating test log via logEventHub:', { campaignId, userEmail, testLogEntry });
      await logEventHub.logAndBroadcast(campaignId, userEmail, testLogEntry);
      return { success: true, message: 'Test log created and broadcasted' };
    } catch (error) {
      console.error('❌ IPC test-log error:', error);
      return { success: false, error: error.message };
    }
  });

  // Clean up orphaned logs (logs from deleted campaigns)
  ipcMain.handle('cleanup-orphaned-logs', async (event, userEmail) => {
    try {
      console.log(`🧹 Starting orphaned logs cleanup for user: ${userEmail}`);
      
      // Get all active campaigns for the user
      const Campaigns = require('../models/Campaigns');
      const User = require('../models/User');
      
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        throw new Error('User not found');
      }
      
      const activeCampaignIds = user.campaigns.map(c => c._id.toString());
      console.log(`📊 Found ${activeCampaignIds.length} active campaigns for user`);
      
      // Get all unique campaign IDs from logs for this user
      const allLogCampaignIds = await sqliteLogger.getUserCampaignIds(userEmail);
      console.log(`📊 Found ${allLogCampaignIds.length} campaigns with logs in database`);
      
      // Find orphaned campaign IDs (exist in logs but not in active campaigns)
      const orphanedCampaignIds = allLogCampaignIds.filter(
        logCampaignId => !activeCampaignIds.includes(logCampaignId)
      );
      
      console.log(`🗑️ Found ${orphanedCampaignIds.length} orphaned campaigns:`, orphanedCampaignIds);
      
      let totalClearedLogs = 0;
      
      // Clear logs for each orphaned campaign
      for (const orphanedId of orphanedCampaignIds) {
        try {
          console.log(`🧹 Clearing logs for orphaned campaign: ${orphanedId}`);
          const cleared = await sqliteLogger.clearLogs(orphanedId, userEmail);
          if (cleared) {
            totalClearedLogs++;
          }
        } catch (clearError) {
          console.warn(`⚠️ Failed to clear logs for orphaned campaign ${orphanedId}:`, clearError.message);
        }
      }
      
      await logEventHub.logFromMain(
        null, 
        userEmail, 
        `Orphaned logs cleanup completed: ${totalClearedLogs} campaigns cleaned`, 
        'info'
      );
      
      return { 
        success: true, 
        message: `Cleanup completed: ${totalClearedLogs} orphaned campaigns cleaned`,
        orphanedCampaigns: orphanedCampaignIds.length,
        clearedCampaigns: totalClearedLogs
      };
    } catch (error) {
      console.error('❌ cleanup-orphaned-logs error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Logging IPC handlers initialized');
}

module.exports = { initializeLoggingHandlers };
