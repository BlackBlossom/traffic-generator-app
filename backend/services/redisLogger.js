// redisLogger.js
// Redis-based logging service for campaign traffic sessions

const Redis = require('ioredis');

class RedisLogger {
  constructor() {
    this.redis = null;
    this.isConnected = false;
    this.maxLogsPerCampaign = 10000; // Store up to 10k logs per campaign
    this.logExpiry = 24 * 60 * 60; // 24 hours in seconds
    this.init();
  }

  async init() {
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 10000,
        commandTimeout: 5000,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null
      });

      // Add event listeners for better connection monitoring
      this.redis.on('connect', () => {
        console.log('🔗 Redis connection established');
      });

      this.redis.on('ready', () => {
        console.log('✅ Redis Logger connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message);
        this.isConnected = false;
      });

      this.redis.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
      });

      await this.redis.connect();
      
    } catch (error) {
      console.error('❌ Redis Logger connection failed:', error.message);
      this.isConnected = false;
    }
  }

  // Log a message for a specific campaign
  async logCampaign(campaignId, message, level = 'info') {
    if (!this.isConnected) {
      console.log(`[${level}] ${message}`); // Fallback to console
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level,
        message,
        campaignId
      };

      const logKey = `campaign:${campaignId}:logs`;
      const logString = JSON.stringify(logEntry);

      // Add to Redis list (most recent first)
      await this.redis.lpush(logKey, logString);
      
      // Trim to keep only the latest logs
      await this.redis.ltrim(logKey, 0, this.maxLogsPerCampaign - 1);
      
      // Set expiry on the key
      await this.redis.expire(logKey, this.logExpiry);

    } catch (error) {
      console.error('❌ Redis logging failed:', error);
      console.log(`[${level}] ${message}`); // Fallback to console
    }
  }

  // Push a log entry for a specific campaign and user (used by traffic controllers)
  async pushLog(campaignId, userEmail, logEntry) {
    // console.log(`🔍 pushLog called: campaign=${campaignId}, user=${userEmail}, level=${logEntry.level}, message="${logEntry.message}"`);
    
    if (!this.isConnected) {
      console.log(`[${logEntry.level}] ${logEntry.message}`); // Fallback to console
      return;
    }

    try {
      // Use user-specific campaign logs
      const logKey = `campaign:${campaignId}:user:${userEmail}:logs`;
      
      // Add user info to log entry
      const enhancedLogEntry = {
        ...logEntry,
        campaignId,
        userEmail
      };

      // Push to Redis list (LPUSH for newest first)
      await this.redis.lpush(logKey, JSON.stringify(enhancedLogEntry));
      
      // Trim list to maintain max logs per campaign
      await this.redis.ltrim(logKey, 0, this.maxLogsPerCampaign - 1);
      
      // Set expiry on the key
      await this.redis.expire(logKey, this.logExpiry);

    //   console.log(`✅ Redis log stored: ${logKey} - ${logEntry.level}: ${logEntry.message}`);

    } catch (error) {
      console.error('❌ Redis pushLog failed:', error);
      console.log(`[${logEntry.level}] ${logEntry.message}`); // Fallback to console
    }
  }

  // Initialize logs for a new campaign
  async initializeCampaignLogs(campaignId) {
    if (!this.isConnected) {
      console.log(`Cannot initialize logs - no Redis connection`);
      return false;
    }

    try {
      const logKey = `campaign:${campaignId}:logs`;
      
      // Initialize with a startup log
      const initLogEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        message: `Campaign ${campaignId} analytics initialized`,
        campaignId
      };

      await this.redis.lpush(logKey, JSON.stringify(initLogEntry));
      await this.redis.expire(logKey, this.logExpiry);
      
      console.log(`✅ Redis logs initialized for campaign ${campaignId}`);
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
      console.log(`⚠️ getLogCount: Redis not connected`);
      return 0;
    }

    if (!this.redis) {
      console.log(`⚠️ getLogCount: Redis client not available`);
      return 0;
    }

    try {
      // Use user-specific logs if userEmail is provided, otherwise use campaign logs
      const logKey = userEmail 
        ? `campaign:${campaignId}:user:${userEmail}:logs`
        : `campaign:${campaignId}:logs`;
        
      console.log(`🔍 getLogCount: checking key "${logKey}"`);
      console.log(`🔍 getLogCount: redis client exists:`, !!this.redis);
      console.log(`🔍 getLogCount: isConnected:`, this.isConnected);
      
      const count = await this.redis.llen(logKey);
      console.log(`📊 getLogCount result: ${count} for key "${logKey}"`);
      return count || 0;
    } catch (error) {
      console.error(`❌ Error getting log count for campaign ${campaignId}:`, error.message);
      console.error(`❌ Full error:`, error);
      return 0;
    }
  }

  // Fetch logs for a specific campaign
  async fetchLogs(campaignId, userEmail = null, limit = 100) {
    if (!this.isConnected) {
      return [`No Redis connection available. Campaign: ${campaignId}`];
    }

    try {
      // Use user-specific logs if userEmail is provided, otherwise use campaign logs
      const logKey = userEmail 
        ? `campaign:${campaignId}:user:${userEmail}:logs`
        : `campaign:${campaignId}:logs`;
        
      console.log(`🔍 fetchLogs: key="${logKey}", limit=${limit}`);
      
      // Handle limit = 0 to mean "fetch all"
      const endIndex = limit === 0 ? -1 : limit - 1;
      console.log(`🔍 fetchLogs: using LRANGE 0 to ${endIndex}`);
      
      const rawLogs = await this.redis.lrange(logKey, 0, endIndex);
      console.log(`📋 fetchLogs: got ${rawLogs.length} raw logs`);
      
      const logs = rawLogs.map(rawLog => {
        try {
          const parsed = JSON.parse(rawLog);
          // Format log with session ID if available
          const sessionInfo = parsed.sessionId ? ` [${parsed.sessionId}]` : '';
          return `[${parsed.timestamp}]${sessionInfo} ${parsed.level.toUpperCase()}: ${parsed.message}`;
        } catch (e) {
          return rawLog; // Return raw string if parsing fails
        }
      });

      const targetInfo = userEmail ? `campaign ${campaignId} (user: ${userEmail})` : `campaign ${campaignId}`;
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
      console.log(`Cannot clear logs - no Redis connection`);
      return false;
    }

    try {
      if (userEmail) {
        // Clear user-specific logs
        const logKey = `campaign:${campaignId}:user:${userEmail}:logs`;
        await this.redis.del(logKey);
        console.log(`🧹 Cleared logs for campaign ${campaignId} (user: ${userEmail})`);
      } else {
        // Clear all logs for campaign (including user-specific ones)
        const pattern = `campaign:${campaignId}:*:logs`;
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        console.log(`🧹 Cleared all logs for campaign ${campaignId} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      console.error('❌ Error clearing logs:', error);
      return false;
    }
  }

  // Log a general message (not campaign-specific)
  async log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    
    if (this.isConnected) {
      try {
        const logEntry = {
          timestamp,
          level,
          message
        };
        
        await this.redis.lpush('system:logs', JSON.stringify(logEntry));
        await this.redis.ltrim('system:logs', 0, 1000); // Keep last 1000 system logs
        await this.redis.expire('system:logs', this.logExpiry);
      } catch (error) {
        console.error('❌ Redis system logging failed:', error);
      }
    }
  }

  // Get system logs
  async getSystemLogs(limit = 100) {
    if (!this.isConnected) {
      return ['No Redis connection available'];
    }

    try {
      const rawLogs = await this.redis.lrange('system:logs', 0, limit - 1);
      return rawLogs.map(rawLog => {
        try {
          const parsed = JSON.parse(rawLog);
          return `[${parsed.timestamp}] ${parsed.level.toUpperCase()}: ${parsed.message}`;
        } catch (e) {
          return rawLog;
        }
      });
    } catch (error) {
      console.error('❌ Error fetching system logs:', error);
      return [`Error fetching system logs: ${error.message}`];
    }
  }

  // Check Redis connection health
  async checkHealth() {
    if (!this.redis) {
      return { connected: false, error: 'Redis client not initialized' };
    }

    try {
      const start = Date.now();
      await this.redis.ping();
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

  // Attempt to reconnect to Redis
  async reconnect() {
    console.log('🔄 Attempting Redis reconnection...');
    try {
      if (this.redis) {
        await this.redis.disconnect();
      }
      await this.init();
      return this.isConnected;
    } catch (error) {
      console.error('❌ Redis reconnection failed:', error.message);
      return false;
    }
  }

  // Close Redis connection
  async close() {
    if (this.redis) {
      await this.redis.quit();
      this.isConnected = false;
      console.log('🔌 Redis Logger disconnected');
    }
  }
}

// Create and export singleton instance
const redisLogger = new RedisLogger();

module.exports = redisLogger;
