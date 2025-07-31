// logEventHub.js
// Electron IPC-based log event hub for real-time log broadcasting

const EventEmitter = require('events');
const sqliteLogger = require('./sqliteLogger');

class LogEventHub extends EventEmitter {
  constructor() {
    super();
    this.windows = new Set();
    this.maxListeners = 100; // Increase max listeners for high concurrency
    this.setMaxListeners(this.maxListeners);
  }

  addWindow(window) {
    this.windows.add(window);
    console.log(`📡 LogEventHub: Window registered for log broadcasting (total: ${this.windows.size})`);
    
    // Clean up when window closes
    window.on('closed', () => {
      this.windows.delete(window);
      console.log(`📡 LogEventHub: Window unregistered (remaining: ${this.windows.size})`);
    });
  }

  broadcastLog(campaignId, logData) {
    // Emit to all renderer windows
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('log-update', {
            campaignId,
            ...logData,
            source: 'main'
          });
        } catch (error) {
          console.error('❌ Failed to broadcast log to window:', error.message);
        }
      }
    });
  }

  async logAndBroadcast(campaignId, userEmail, logEntry) {
    try {
      // Store in SQLite and broadcast immediately
      await sqliteLogger.pushLog(campaignId, userEmail, logEntry);
      
      this.broadcastLog(campaignId, {
        ...logEntry,
        userEmail,
        timestamp: logEntry.timestamp || new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ LogEventHub: Failed to log and broadcast:', error.message);
      
      // Fallback: still try to broadcast even if storage fails
      this.broadcastLog(campaignId, {
        ...logEntry,
        userEmail,
        timestamp: logEntry.timestamp || new Date().toISOString()
      });
    }
  }

  // Specialized method for traffic worker logs
  async logTrafficSession(campaignId, userEmail, sessionId, level, message) {
    const logEntry = {
      level,
      message,
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    await this.logAndBroadcast(campaignId, userEmail, logEntry);
  }

  // Method for general main process logs
  async logFromMain(campaignId, userEmail, message, level = 'info', sessionId = 'main-process') {
    const logEntry = {
      level,
      message,
      sessionId,
      timestamp: new Date().toISOString()
    };
    
    await this.logAndBroadcast(campaignId, userEmail, logEntry);
  }

  // Method for live logs only (no storage, just broadcast)
  broadcastLiveLog(message, level = 'info', sessionId = 'system') {
    const logEntry = {
      level,
      message,
      sessionId,
      timestamp: new Date().toISOString(),
      isLiveOnly: true // Flag to indicate this is a live-only log
    };

    // Broadcast to all windows - NO STORAGE
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('log-update', {
            campaignId: 'LIVE',
            userEmail: 'LIVE', 
            level: logEntry.level,
            message: logEntry.message,
            sessionId: logEntry.sessionId,
            timestamp: logEntry.timestamp,
            isLiveOnly: true,
            source: 'main'
          });
        } catch (error) {
          console.error('❌ Failed to broadcast live log:', error.message);
        }
      }
    });
  }

  // Method for system-wide logs (no specific campaign)
  async logSystem(message, level = 'info') {
    const logEntry = {
      level,
      message,
      sessionId: 'system',
      timestamp: new Date().toISOString()
    };

    // Store in system logs using SQLite
    await sqliteLogger.log(message, level);
    
    // Broadcast to all windows using the same channel as campaign logs
    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('log-update', {
            campaignId: 'SYSTEM',
            userEmail: 'SYSTEM', 
            level: logEntry.level,
            message: logEntry.message,
            sessionId: logEntry.sessionId,
            timestamp: logEntry.timestamp,
            source: 'main'
          });
        } catch (error) {
          console.error('❌ Failed to broadcast system log:', error.message);
        }
      }
    });
  }

  // Get statistics about active connections
  getStats() {
    return {
      activeWindows: this.windows.size,
      maxListeners: this.maxListeners,
      listenerCount: this.listenerCount('log')
    };
  }

  // Clear all logs for a specific campaign from SQLite
  async clearCampaignLogs(campaignId, userEmail = null) {
    try {
      console.log(`🧹 LogEventHub: Clearing logs for campaign ${campaignId}${userEmail ? ` (user: ${userEmail})` : ''}`);
      
      // Use SQLite logger to clear campaign logs
      const result = await sqliteLogger.clearLogs(campaignId, userEmail);
      
      if (result) {
        console.log(`✅ LogEventHub: Successfully cleared logs for campaign ${campaignId}`);
        
        // Broadcast a log cleared notification to all windows
        this.windows.forEach(window => {
          if (!window.isDestroyed()) {
            try {
              window.webContents.send('campaign-logs-cleared', {
                campaignId,
                userEmail,
                timestamp: new Date().toISOString()
              });
            } catch (error) {
              console.error('❌ Failed to broadcast log clear notification:', error.message);
            }
          }
        });
        
        return true;
      } else {
        console.warn(`⚠️ LogEventHub: No logs found to clear for campaign ${campaignId}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ LogEventHub: Failed to clear logs for campaign ${campaignId}:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
const logEventHub = new LogEventHub();

module.exports = logEventHub;
