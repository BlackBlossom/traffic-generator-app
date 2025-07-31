// sqliteLogger.js
// SQLite-based logging service for campaign traffic sessions

const Database = require('better-sqlite3');
const path = require('path');
const { app, BrowserWindow } = require('electron');

class SQLiteLogger {
  constructor() {
    this.db = null;
    this.isConnected = false;
    this.maxLogsPerCampaign = -1; // No limit - store unlimited logs per campaign
    this.logExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.windows = new Set(); // Track renderer windows for live updates
    this.init();
  }

  // Helper method to ensure IDs are strings (handles MongoDB ObjectIds)
  normalizeId(id) {
    return id ? id.toString() : null;
  }

  // Add method to register renderer windows for live updates
  addWindow(window) {
    this.windows.add(window);
    window.on('closed', () => {
      this.windows.delete(window);
    });
    console.log(`✅ Registered window for live log updates. Total windows: ${this.windows.size}`);
  }

  // Broadcast log to all renderer windows
  broadcastLog(campaignId, userEmail, logData) {
    if (this.windows.size === 0) {
      console.log('⚠️ No windows registered for log broadcasting');
      return;
    }

    const broadcastData = {
      campaignId,
      userEmail,
      ...logData,
      source: 'main'
    };

    console.log(`📡 Broadcasting log to ${this.windows.size} windows:`, broadcastData);

    this.windows.forEach(window => {
      if (!window.isDestroyed()) {
        try {
          window.webContents.send('log-update', broadcastData);
        } catch (error) {
          console.error('❌ Error broadcasting log to window:', error);
        }
      }
    });
  }

  async init() {
    try {
      console.log('🔗 SQLite connection establishing...');
      
      // Check if app is ready
      if (!app || !app.isReady || !app.isReady()) {
        console.log('⏳ App not ready yet, waiting...');
        await new Promise(resolve => {
          if (app.isReady()) {
            resolve();
          } else {
            app.once('ready', resolve);
          }
        });
      }
      
      // Create database in user data directory
      const dbPath = path.join(app.getPath('userData'), 'campaign_logs.db');
      console.log(`📁 Database path: ${dbPath}`);
      
      this.db = new Database(dbPath);
      
      // Enable WAL mode for better performance and concurrent access
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 10000');
      this.db.pragma('temp_store = memory');
      
      this.createTables();
      this.isConnected = true;
      console.log('✅ SQLite Logger connected successfully');
      
      // Clean up expired logs on initialization
      this.cleanupExpiredLogs();
      
    } catch (error) {
      console.error('❌ SQLite Logger connection failed:', error.message);
      console.error('Full error:', error);
      this.isConnected = false;
    }
  }

  createTables() {
    // Campaign logs table - equivalent to Redis campaign:campaignId:user:userEmail:logs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaign_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        user_email TEXT,
        session_id TEXT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
      
      -- Indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_campaign_user ON campaign_logs(campaign_id, user_email);
      CREATE INDEX IF NOT EXISTS idx_campaign_only ON campaign_logs(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_user_email ON campaign_logs(user_email);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON campaign_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_expiry ON campaign_logs(expiry);
      CREATE INDEX IF NOT EXISTS idx_created_at ON campaign_logs(created_at DESC);
    `);

    // System logs table - equivalent to Redis system:logs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        expiry INTEGER NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      );
      
      CREATE INDEX IF NOT EXISTS idx_sys_timestamp ON system_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sys_expiry ON system_logs(expiry);
      CREATE INDEX IF NOT EXISTS idx_sys_created_at ON system_logs(created_at DESC);
    `);

    // Prepare frequently used statements for better performance
    this.prepareStatements();
  }

  prepareStatements() {
    // Campaign log operations
    this.insertCampaignLogStmt = this.db.prepare(`
      INSERT INTO campaign_logs (campaign_id, user_email, session_id, level, message, timestamp, expiry)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.getCampaignLogCountStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM campaign_logs 
      WHERE campaign_id = ? AND (? IS NULL OR user_email = ?) AND expiry > ?
    `);

    this.fetchCampaignLogsStmt = this.db.prepare(`
      SELECT timestamp, level, message, session_id
      FROM campaign_logs 
      WHERE campaign_id = ? AND (? IS NULL OR user_email = ?) AND expiry > ?
      ORDER BY created_at ASC 
      LIMIT ?
    `);

    this.clearCampaignLogsStmt = this.db.prepare(`
      DELETE FROM campaign_logs 
      WHERE campaign_id = ? AND (? IS NULL OR user_email = ?)
    `);

    // System log operations
    this.insertSystemLogStmt = this.db.prepare(`
      INSERT INTO system_logs (level, message, timestamp, expiry)
      VALUES (?, ?, ?, ?)
    `);

    this.fetchSystemLogsStmt = this.db.prepare(`
      SELECT timestamp, level, message
      FROM system_logs 
      WHERE expiry > ?
      ORDER BY created_at ASC 
      LIMIT ?
    `);

    // User statistics
    this.getUserStatsStmt = this.db.prepare(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT campaign_id) as active_campaigns,
        MAX(timestamp) as last_activity
      FROM campaign_logs 
      WHERE user_email = ? AND expiry > ?
    `);
  }

  // Log a message for a specific campaign
  async logCampaign(campaignId, message, level = 'info') {
    if (!this.isConnected) {
      console.log(`[${level}] ${message}`); // Fallback to console
      return;
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      const timestamp = new Date().toISOString();
      const expiry = Date.now() + this.logExpiry;

      this.insertCampaignLogStmt.run(
        campaignIdStr,
        null, // No user email for campaign-only logs
        null, // No session ID
        level,
        message,
        timestamp,
        expiry
      );

      // ✅ IMPORTANT: Broadcast immediately to frontend
      this.broadcastLog(campaignIdStr, null, {
        level,
        message,
        timestamp,
        campaignId: campaignIdStr,
        sessionId: null
      });

      // Trim logs to maintain max limit
      this.trimCampaignLogs(campaignIdStr);

    } catch (error) {
      console.error('❌ SQLite logging failed:', error);
      console.log(`[${level}] ${message}`); // Fallback to console
    }
  }

  // Push a log entry for a specific campaign and user (used by traffic controllers)
  async pushLog(campaignId, userEmail, logEntry) {
    console.log(`🔍 pushLog called - connected: ${this.isConnected}, campaignId: ${campaignId}, userEmail: ${userEmail}`);
    
    if (!this.isConnected) {
      console.log(`⚠️ SQLite not connected - attempting reconnection...`);
      await this.init(); // Try to reconnect
      
      if (!this.isConnected) {
        console.log(`❌ SQLite still not connected - falling back to console log`);
        console.log(`[${logEntry.level}] ${logEntry.message}`); // Fallback to console
        return;
      }
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      const timestamp = logEntry.timestamp || new Date().toISOString();
      const expiry = Date.now() + this.logExpiry;

      console.log(`💾 Storing log in SQLite - campaign: ${campaignIdStr}, user: ${userEmail}, level: ${logEntry.level}`);

      // Store in SQLite
      this.insertCampaignLogStmt.run(
        campaignIdStr,
        userEmail,
        logEntry.sessionId || null,
        logEntry.level,
        logEntry.message,
        timestamp,
        expiry
      );

      console.log(`✅ Log stored successfully in SQLite database`);

      // ✅ IMPORTANT: Broadcast immediately to frontend
      this.broadcastLog(campaignIdStr, userEmail, {
        ...logEntry,
        timestamp,
        campaignId: campaignIdStr,
        userEmail
      });

      // Trim user-specific campaign logs
      this.trimCampaignUserLogs(campaignIdStr, userEmail);

    } catch (error) {
      console.error('❌ SQLite pushLog failed:', error);
      console.log(`[${logEntry.level}] ${logEntry.message}`); // Fallback to console
    }
  }

  // Initialize logs for a new campaign
  async initializeCampaignLogs(campaignId) {
    if (!this.isConnected) {
      console.log(`Cannot initialize logs - no SQLite connection`);
      return false;
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      const timestamp = new Date().toISOString();
      const expiry = Date.now() + this.logExpiry;

      this.insertCampaignLogStmt.run(
        campaignIdStr,
        null,
        null,
        'info',
        `Campaign ${campaignIdStr} analytics initialized`,
        timestamp,
        expiry
      );

      console.log(`✅ SQLite logs initialized for campaign ${campaignIdStr}`);
      return true;
    } catch (error) {
      console.error(`❌ Error initializing logs for campaign ${campaignId}:`, error);
      return false;
    }
  }

  // Get the count of logs for a campaign (optionally user-specific)
  async getLogCount(campaignId, userEmail = null) {
    console.log(`🔍 getLogCount: START - campaignId=${campaignId}, userEmail=${userEmail}`);
    
    if (!this.isConnected) {
      console.log(`⚠️ getLogCount: SQLite not connected`);
      return 0;
    }

    if (!this.db) {
      console.log(`⚠️ getLogCount: SQLite client not available`);
      return 0;
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      const now = Date.now();
      const result = this.getCampaignLogCountStmt.get(campaignIdStr, userEmail, userEmail, now);
      
      const count = result?.count || 0;
      console.log(`📊 getLogCount result: ${count} for campaign ${campaignIdStr}${userEmail ? ` (user: ${userEmail})` : ''}`);
      return count;
    } catch (error) {
      console.error(`❌ Error getting log count for campaign ${campaignId}:`, error.message);
      return 0;
    }
  }

  // Fetch logs for a specific campaign
  async fetchLogs(campaignId, userEmail = null, limit = 0) {
    if (!this.isConnected) {
      return [`No SQLite connection available. Campaign: ${campaignId}`];
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      console.log(`🔍 fetchLogs: campaignId=${campaignIdStr}, userEmail=${userEmail}, limit=${limit}`);
      
      const now = Date.now();
      
      let rows;
      if (limit === 0 || this.maxLogsPerCampaign === -1) {
        // Unlimited logs - get all in chronological order
        rows = this.fetchCampaignLogsStmt.all(campaignIdStr, userEmail, userEmail, now, 999999);
      } else {
        // Limited logs - get most recent ones, then reverse for chronological order
        const stmt = this.db.prepare(`
          SELECT timestamp, level, message, session_id
          FROM campaign_logs 
          WHERE campaign_id = ? AND (? IS NULL OR user_email = ?) AND expiry > ?
          ORDER BY created_at DESC 
          LIMIT ?
        `);
        rows = stmt.all(campaignIdStr, userEmail, userEmail, now, limit);
        rows.reverse(); // Reverse to get chronological order (oldest first)
      }
      
      console.log(`📋 fetchLogs: got ${rows.length} raw logs`);
      
      const logs = rows.map(row => {
        // Format log with session ID if available
        const sessionInfo = row.session_id ? ` [${row.session_id}]` : '';
        return `[${row.timestamp}]${sessionInfo} ${row.level.toUpperCase()}: ${row.message}`;
      });

      const targetInfo = userEmail ? `campaign ${campaignIdStr} (user: ${userEmail})` : `campaign ${campaignIdStr}`;
      const result = logs.length > 0 ? logs : [`No logs found for ${targetInfo}`];
      console.log(`📋 fetchLogs: returning ${result.length} formatted logs`);
      return result;
      
    } catch (error) {
      console.error('❌ Error fetching logs:', error);
      return [`Error fetching logs: ${error.message}`];
    }
  }

  // Clear logs for a specific campaign (optionally user-specific)
  async clearLogs(campaignId, userEmail = null) {
    if (!this.isConnected) {
      console.log(`Cannot clear logs - no SQLite connection`);
      return false;
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      const result = this.clearCampaignLogsStmt.run(campaignIdStr, userEmail, userEmail);
      
      if (userEmail) {
        console.log(`🧹 Cleared logs for campaign ${campaignIdStr} (user: ${userEmail}) - ${result.changes} logs deleted`);
      } else {
        console.log(`🧹 Cleared all logs for campaign ${campaignIdStr} - ${result.changes} logs deleted`);
      }
      return true;
    } catch (error) {
      console.error('❌ Error clearing logs:', error);
      return false;
    }
  }

  // Clear ALL logs from the database (system and campaign logs)
  async clearAllLogs() {
    if (!this.isConnected) {
      console.log(`Cannot clear all logs - no SQLite connection`);
      return false;
    }

    try {
      const campaignResult = this.db.prepare('DELETE FROM campaign_logs').run();
      const systemResult = this.db.prepare('DELETE FROM system_logs').run();
      
      console.log(`🧹 Cleared ALL logs from database - Campaign logs: ${campaignResult.changes}, System logs: ${systemResult.changes}`);
      return true;
    } catch (error) {
      console.error('❌ Error clearing all logs:', error);
      return false;
    }
  }

  // Log a general message (not campaign-specific)
  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    
    if (this.isConnected) {
      try {
        const expiry = Date.now() + this.logExpiry;

        this.insertSystemLogStmt.run(level, message, timestamp, expiry);
        
        // Trim system logs to keep last 1000
        this.trimSystemLogs();
      } catch (error) {
        console.error('❌ SQLite system logging failed:', error);
      }
    }
  }

  // Get system logs
  async getSystemLogs(limit = 0) {
    if (!this.isConnected) {
      return [];
    }

    try {
      let rows;
      const now = Date.now();
      
      if (limit === 0 || this.maxLogsPerCampaign === -1) {
        // Unlimited logs - get all in chronological order
        rows = this.fetchSystemLogsStmt.all(now, 999999);
      } else {
        // Limited logs - get most recent ones, then reverse for chronological order
        const stmt = this.db.prepare(`
          SELECT timestamp, level, message
          FROM system_logs 
          WHERE expiry > ?
          ORDER BY created_at DESC 
          LIMIT ?
        `);
        rows = stmt.all(now, limit);
        rows.reverse(); // Reverse to get chronological order (oldest first)
      }
      
      return rows.map(row => ({
        timestamp: row.timestamp,
        message: row.message || 'No message content', // Provide fallback
        level: row.level
      }));
    } catch (error) {
      console.error('❌ Error fetching system logs:', error);
      return [];
    }
  }

  // Get user log statistics
  async getUserLogStats(userEmail) {
    if (!this.isConnected) {
      return { totalLogs: 0, activeCampaigns: 0, lastActivity: null };
    }

    try {
      const now = Date.now();
      const result = this.getUserStatsStmt.get(userEmail, now);
      
      return {
        totalLogs: result?.total_logs || 0,
        activeCampaigns: result?.active_campaigns || 0,
        lastActivity: result?.last_activity
      };
    } catch (error) {
      console.error('❌ Error getting user log stats:', error);
      return { totalLogs: 0, activeCampaigns: 0, lastActivity: null };
    }
  }

  // Get user global logs (all campaigns for a user)
  async getUserGlobalLogs(userEmail, limit = 0) {
    if (!this.isConnected) {
      return [];
    }

    try {
      let rows;
      const now = Date.now();
      
      if (limit === 0 || this.maxLogsPerCampaign === -1) {
        // Unlimited logs - get all in chronological order
        const stmt = this.db.prepare(`
          SELECT timestamp, level, message, campaign_id
          FROM campaign_logs 
          WHERE user_email = ? AND expiry > ?
          ORDER BY created_at ASC 
          LIMIT 999999
        `);
        rows = stmt.all(userEmail, now);
      } else {
        // Limited logs - get most recent ones, then reverse for chronological order
        const stmt = this.db.prepare(`
          SELECT timestamp, level, message, campaign_id
          FROM campaign_logs 
          WHERE user_email = ? AND expiry > ?
          ORDER BY created_at DESC 
          LIMIT ?
        `);
        rows = stmt.all(userEmail, now, limit);
        rows.reverse(); // Reverse to get chronological order (oldest first)
      }
      
      return rows.map(row => ({
        timestamp: row.timestamp,
        message: row.message || 'No message content', // Provide fallback
        level: row.level,
        campaignId: row.campaign_id
      }));
    } catch (error) {
      console.error('❌ Error getting user global logs:', error);
      return [];
    }
  }

  // Get raw logs for analytics (equivalent to getRawLogsFromRedis)
  async getRawLogsFromSQLite(campaignId, userEmail) {
    if (!this.isConnected) {
      console.log(`⚠️ getRawLogsFromSQLite: SQLite not connected`);
      return [];
    }

    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      
      const stmt = this.db.prepare(`
        SELECT *
        FROM campaign_logs 
        WHERE campaign_id = ? AND user_email = ? AND expiry > ?
        ORDER BY created_at ASC
      `);

      const now = Date.now();
      const rows = stmt.all(campaignIdStr, userEmail, now);
      
      return rows.map(row => ({
        timestamp: row.timestamp,
        level: row.level,
        message: row.message,
        sessionId: row.session_id || 'unknown',
        campaignId: row.campaign_id,
        userEmail: row.user_email
      }));
    } catch (error) {
      console.error(`❌ Error getting raw logs for campaign ${campaignId}:`, error);
      return [];
    }
  }

  // Check SQLite connection health
  async checkHealth() {
    if (!this.db) {
      return { connected: false, error: 'SQLite client not initialized' };
    }

    try {
      const start = Date.now();
      
      // Test with a simple query
      this.db.prepare('SELECT 1').get();
      
      const latency = Date.now() - start;
      
      return {
        connected: true,
        latency: `${latency}ms`,
        status: 'healthy'
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message,
        status: 'unhealthy'
      };
    }
  }

  // Attempt to reconnect to SQLite
  async reconnect() {
    console.log('🔄 Attempting SQLite reconnection...');
    try {
      if (this.db) {
        this.db.close();
      }
      await this.init();
      return this.isConnected;
    } catch (error) {
      console.error('❌ SQLite reconnection failed:', error.message);
      return false;
    }
  }

  // Close SQLite connection
  async close() {
    if (this.db) {
      this.db.close();
      this.isConnected = false;
      console.log('🔌 SQLite Logger disconnected');
    }
  }

  // Helper methods for maintenance

  trimCampaignLogs(campaignId) {
    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      
      // Skip trimming if maxLogsPerCampaign is -1 (unlimited)
      if (this.maxLogsPerCampaign === -1) {
        return; // No limits, keep all logs
      }
      
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM campaign_logs 
        WHERE campaign_id = ? AND user_email IS NULL
      `);

      const { count } = countStmt.get(campaignIdStr);

      if (count > this.maxLogsPerCampaign) {
        const deleteStmt = this.db.prepare(`
          DELETE FROM campaign_logs 
          WHERE campaign_id = ? AND user_email IS NULL AND id NOT IN (
            SELECT id FROM campaign_logs 
            WHERE campaign_id = ? AND user_email IS NULL
            ORDER BY created_at DESC 
            LIMIT ?
          )
        `);

        deleteStmt.run(campaignIdStr, campaignIdStr, this.maxLogsPerCampaign);
      }
    } catch (error) {
      console.error('❌ Error trimming campaign logs:', error);
    }
  }

  trimCampaignUserLogs(campaignId, userEmail) {
    try {
      const campaignIdStr = this.normalizeId(campaignId); // ✅ Normalize ID
      
      const countStmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM campaign_logs 
        WHERE campaign_id = ? AND user_email = ?
      `);

      const { count } = countStmt.get(campaignIdStr, userEmail);

      if (count > this.maxLogsPerCampaign) {
        const deleteStmt = this.db.prepare(`
          DELETE FROM campaign_logs 
          WHERE campaign_id = ? AND user_email = ? AND id NOT IN (
            SELECT id FROM campaign_logs 
            WHERE campaign_id = ? AND user_email = ? 
            ORDER BY created_at DESC 
            LIMIT ?
          )
        `);

        deleteStmt.run(campaignIdStr, userEmail, campaignIdStr, userEmail, this.maxLogsPerCampaign);
      }
    } catch (error) {
      console.error('❌ Error trimming campaign user logs:', error);
    }
  }

  trimSystemLogs() {
    try {
      // Skip trimming system logs for unlimited mode
      if (this.maxLogsPerCampaign === -1) {
        return; // No limits, keep all system logs
      }
      
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM system_logs');
      const { count } = countStmt.get();

      if (count > 1000) {
        const deleteStmt = this.db.prepare(`
          DELETE FROM system_logs 
          WHERE id NOT IN (
            SELECT id FROM system_logs 
            ORDER BY created_at DESC 
            LIMIT 1000
          )
        `);

        deleteStmt.run();
      }
    } catch (error) {
      console.error('❌ Error trimming system logs:', error);
    }
  }

  // Get all unique campaign IDs for a user from logs
  async getUserCampaignIds(userEmail) {
    if (!this.isConnected) {
      console.log(`Cannot get user campaign IDs - no SQLite connection`);
      return [];
    }

    try {
      const stmt = this.db.prepare(`
        SELECT DISTINCT campaign_id 
        FROM campaign_logs 
        WHERE user_email = ? AND campaign_id IS NOT NULL
      `);
      
      const rows = stmt.all(userEmail);
      const campaignIds = rows.map(row => row.campaign_id).filter(id => id && id !== 'SYSTEM');
      
      console.log(`📊 Found ${campaignIds.length} unique campaign IDs in logs for user ${userEmail}`);
      return campaignIds;
    } catch (error) {
      console.error('❌ Error getting user campaign IDs:', error);
      return [];
    }
  }

  cleanupExpiredLogs() {
    try {
      const now = Date.now();
      
      const deleteCampaignStmt = this.db.prepare('DELETE FROM campaign_logs WHERE expiry < ?');
      const deleteSystemStmt = this.db.prepare('DELETE FROM system_logs WHERE expiry < ?');
      
      const campaignDeleted = deleteCampaignStmt.run(now);
      const systemDeleted = deleteSystemStmt.run(now);
      
      if (campaignDeleted.changes > 0 || systemDeleted.changes > 0) {
        console.log(`🧹 Cleaned up ${campaignDeleted.changes + systemDeleted.changes} expired logs`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired logs:', error);
    }
  }
}

// Create and export singleton instance
const sqliteLogger = new SQLiteLogger();

module.exports = sqliteLogger;
