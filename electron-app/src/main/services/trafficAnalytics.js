// trafficAnalytics.js - OPTIMIZED & SIMPLIFIED VERSION
// Traffic analytics service with simplified chart calculations
// Uses direct timestamp placement for accurate data visualization

const Campaign = require('../models/Campaigns');
const User = require('../models/User');
const sqliteLogger = require('./sqliteLogger');

class TrafficAnalytics {

  /**
   * Get comprehensive analytics data for dashboard
   * @param {Array|null} campaignIds - Specific campaign IDs (null for all)
   * @param {string} userEmail - User email for filtering
   * @returns {Object} Analytics data with overview, timeSeries, sources, and campaigns
   */
  async getAnalyticsData(campaignIds = null, userEmail) {
    try {
      console.log(`📊 Getting analytics data for user: ${userEmail}`);
      
      // Find user first, then get their campaigns
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        console.log(`❌ User not found: ${userEmail}`);
        return this.getEmptyAnalytics();
      }

      let campaigns = user.campaigns || [];
      
      // Filter by campaign IDs if provided
      if (campaignIds && campaignIds.length > 0) {
        campaigns = campaigns.filter(campaign => 
          campaignIds.includes(campaign._id.toString())
        );
      }

      if (!campaigns || campaigns.length === 0) {
        return this.getEmptyAnalytics();
      }

      // Get user dashboard analytics
      let userDashboard = null;
      if (user.dashboardAnalytics) {
        userDashboard = user.dashboardAnalytics;
      }

      // Initialize data
      const campaignAnalytics = {};
      let totalSessions = 0;
      let activeSessions = 0;
      let completedSessions = 0;
      let bouncedSessions = 0;
      let erroredSessions = 0;
      let totalDuration = 0;
      let sessionCount = 0;
      let mobileCount = 0;
      let desktopCount = 0;

      for (const campaign of campaigns) {
        // Use campaign analytics directly from database
        const analytics = campaign.analytics || {};
        const campaignData = {
          campaign: {
            id: campaign._id,
            url: campaign.url,
            isActive: campaign.isActive,
            status: campaign.status || (campaign.isActive ? 'active' : 'inactive'),
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt
          },
          totalSessions: analytics.totalSessions || campaign.totalSessions || 0,
          activeSessions: analytics.activeSessions || 0,
          completedSessions: analytics.completedSessions || campaign.completedSessions || 0,
          bouncedSessions: analytics.bouncedSessions || campaign.bouncedSessions || 0,
          erroredSessions: analytics.erroredSessions || 0,
          avgDuration: analytics.avgDuration || campaign.avgDuration || 0,
          mobileCount: analytics.devices?.mobile || 0,
          desktopCount: analytics.devices?.desktop || 0,
          sessionCount: analytics.totalSessions || campaign.totalSessions || 0,
          totalDuration: analytics.totalDuration || (analytics.totalSessions * analytics.avgDuration) || 0,
          efficiency: analytics.efficiency || 0,
          bounceRate: analytics.bounceRate || 0
        };
        
        campaignAnalytics[campaign._id] = campaignData;
        
        totalSessions += campaignData.totalSessions;
        activeSessions += campaignData.activeSessions;
        completedSessions += campaignData.completedSessions;
        bouncedSessions += campaignData.bouncedSessions;
        erroredSessions += campaignData.erroredSessions;
        totalDuration += campaignData.totalDuration;
        sessionCount += campaignData.sessionCount;
        mobileCount += campaignData.mobileCount;
        desktopCount += campaignData.desktopCount;
      }

      // Calculate chart data from database
      const chartTimeSeriesData = await this.calculateChartTimeSeriesFromDatabase(campaigns, userEmail);
      const chartSourceData = await this.calculateChartSourcesFromDatabase(campaigns, userEmail);
      const sourcesStats = await this.getSourceDataForCampaigns(campaigns, userEmail);

      const avgDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : (userDashboard?.avgDuration || 0);
      const bounceRate = completedSessions > 0 ? Math.round((bouncedSessions / completedSessions) * 100) : (userDashboard?.bounceRate || 0);
      const efficiency = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      return {
        overview: {
          // Core session metrics
          totalSessions: Math.max(totalSessions, userDashboard?.totalSessions || 0),
          activeSessions: Math.max(activeSessions, userDashboard?.activeSessions || 0),
          completedSessions,
          bouncedSessions,
          erroredSessions,
          avgDuration,
          mobileCount,
          desktopCount,
          bounceRate,
          
          // Enhanced metrics with user dashboard data
          totalVisits: userDashboard?.totalVisits || totalSessions,
          totalCampaigns: userDashboard?.totalCampaigns || campaigns.length,
          activeCampaigns: userDashboard?.activeCampaigns || campaigns.filter(c => c.isActive).length,
          completedCampaigns: userDashboard?.completedCampaigns || campaigns.filter(c => c.status === 'completed').length,
          
          // Performance metrics
          efficiency,
          
          // Device percentages for charts
          desktopPercentage: (mobileCount + desktopCount) > 0 ? Math.round((desktopCount / (mobileCount + desktopCount)) * 100) : 70,
          mobilePercentage: (mobileCount + desktopCount) > 0 ? Math.round((mobileCount / (mobileCount + desktopCount)) * 100) : 30,
          
          // User context for additional insights
          userDashboard: userDashboard ? {
            lastUpdated: userDashboard.lastUpdated,
            totalEfficiency: userDashboard.totalEfficiency || 0,
            topCampaign: userDashboard.topCampaign || { name: 'No campaigns', visits: 0, efficiency: 0 }
          } : null
        },
        timeSeries: chartTimeSeriesData,
        sources: chartSourceData,
        campaigns: campaignAnalytics,
        sourcesStats: sourcesStats
      };

    } catch (error) {
      console.error('❌ Error getting analytics data:', error);
      throw error;
    }
  }

  async getSourceDataForCampaigns(campaigns, userEmail) {
    const sources = {
      organic: 0,
      direct: 0,
      social: 0,
      referral: 0
    };
    for (const campaign of campaigns) {
      const analytics = campaign.analytics || {};
      const campaignSources = await this.getSourceDataForCampaign(analytics);
      sources.organic += campaignSources.organic;
      sources.direct += campaignSources.direct;
      sources.social += campaignSources.social;
      sources.referral += campaignSources.referral;
    }
    return sources;
  }

  
/**
 * Get raw logs from SQLite for a specific campaign and user
 * @param {string} campaignId - Campaign ID
 * @param {string} userEmail - User email
 * @returns {Array} Raw log entries
 */
async getRawLogsFromSQLite(campaignId, userEmail) {
  try {
    if (!sqliteLogger.isConnected) {
      console.log(`⚠️ getRawLogsFromSQLite: SQLite not connected`);
      return [];
    }

    // Use SQLite logger to get raw logs
    const rawLogs = await sqliteLogger.getRawLogsFromSQLite(campaignId, userEmail);

    // Sort by timestamp (newest first to match Redis LRANGE behavior)
    const sortedLogs = rawLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return raw log objects (already parsed from SQLite)
    return sortedLogs.map(log => {
      try {
        // Return the log object directly (already parsed from SQLite)
        return {
          timestamp: log.timestamp || new Date().toISOString(),
          level: log.level || 'info',
          message: log.message || '',
          sessionId: log.sessionId || 'unknown',
          campaignId: log.campaignId,
          userEmail: log.userEmail,
          ...log // Include any additional fields
        };
      } catch (e) {
        // Fallback for corrupted log entries
        return { 
          timestamp: new Date().toISOString(), 
          level: 'error', 
          message: JSON.stringify(log), 
          sessionId: 'unknown',
          campaignId,
          userEmail
        };
      }
    });

  } catch (error) {
    console.error(`❌ Error getting raw logs for campaign ${campaignId}:`, error);
    return [];
  }
}

  /**
   * Extract session data from raw logs
   * @param {Array} rawLogs - Raw log entries
   * @returns {Array} Processed session objects
   */
  extractSessionsFromLogs(rawLogs) {
    const sessionsMap = new Map();
    
    rawLogs.forEach(log => {
      const sessionId = log.sessionId || 'unknown';
      
      if (!sessionsMap.has(sessionId)) {
        sessionsMap.set(sessionId, {
          id: sessionId,
          startTime: log.timestamp,
          endTime: log.timestamp,
          status: 'active',
          events: [],
          deviceType: 'desktop',
          source: 'direct',
          referrer: null,
          proxy: null,
          duration: 0,
          url: null
        });
      }
      
      const session = sessionsMap.get(sessionId);
      session.endTime = log.timestamp;
      session.events.push(log);
      
      this.updateSessionFromLogMessage(session, log);
    });

    return Array.from(sessionsMap.values()).map(session => {
      session.duration = this.calculateSessionDuration(session.startTime, session.endTime);
      session.status = this.determineSessionStatus(session);
      return session;
    });
  }

  /**
   * Update session data based on log message content
   * @param {Object} session - Session object to update
   * @param {Object} log - Log entry
   */
  updateSessionFromLogMessage(session, log) {
    const message = log.message.toLowerCase();
    

    if (message.includes('mobile') || message.includes('android') || message.includes('iphone')) {
      session.deviceType = 'mobile';
    }
    
    if (message.includes('google') || message.includes('search')) {
      session.source = 'organic';
    } else if (message.includes('facebook') || message.includes('twitter') || message.includes('instagram')) {
      session.source = 'social';
    } else if (message.includes('referrer:') || message.includes('referred')) {
      session.source = 'referral';
      const referrerMatch = log.message.match(/referrer:\s*([^\s,]+)/i);
      if (referrerMatch) {
        session.referrer = referrerMatch[1];
      }
    }
    
    if (message.includes('proxy:') || message.includes('using proxy')) {
      const proxyMatch = log.message.match(/proxy:\s*([^\s,]+)/i);
      if (proxyMatch) {
        session.proxy = proxyMatch[1];
      }
    }
    
    // Detect URL
    if (message.includes('visiting:') || message.includes('navigating to')) {
      const urlMatch = log.message.match(/(?:visiting:|navigating to)\s*([^\s,]+)/i);
      if (urlMatch) {
        session.url = urlMatch[1];
      }
    }
    
    // Update status based on log level and message
    if (log.level === 'error' || message.includes('error') || message.includes('failed')) {
      session.status = 'error';
    } else if (message.includes('completed') || message.includes('finished')) {
      session.status = 'completed';
    } else if (message.includes('bounced') || message.includes('bounce')) {
      session.status = 'bounced';
    } else if (message.includes('timeout')) {
      session.status = 'timeout';
    }
  }

  /**
   * Calculate session duration in seconds
   * @param {string} startTime - Start timestamp
   * @param {string} endTime - End timestamp
   * @returns {number} Duration in seconds
   */
  calculateSessionDuration(startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      return Math.max(0, Math.round((end - start) / 1000));
    } catch (error) {
      return 0;
    }
  }

  /**
   * Determine final session status based on events
   * @param {Object} session - Session object
   * @returns {string} Session status
   */
  determineSessionStatus(session) {
    const hasError = session.events.some(e => e.level === 'error');
    const hasCompletion = session.events.some(e => e.message.toLowerCase().includes('completed'));
    const hasBounce = session.events.some(e => e.message.toLowerCase().includes('bounced'));
    const hasTimeout = session.events.some(e => e.message.toLowerCase().includes('timeout'));
    
    if (hasError) return 'error';
    if (hasTimeout) return 'timeout';
    if (hasBounce) return 'bounced';
    if (hasCompletion) return 'completed';
    
    const lastActivity = new Date(session.endTime);
    const now = new Date();
    const isRecent = (now - lastActivity) < 5 * 60 * 1000; // 5 minutes
    
    return isRecent ? 'active' : 'completed';
  }

  /**
   * Calculate time series chart data using timestamps
   * @param {Array} campaigns - Campaign documents
   * @param {string} userEmail - User email for filtering
   * @returns {Object} Time series data for charts
   */
  async calculateChartTimeSeriesFromDatabase(campaigns, userEmail) {
    const timeSeries = this.initializeChartData('timeSeries');
    
    try {
      for (const campaign of campaigns) {
        const analytics = campaign.analytics || {};
        const dbTotalSessions = analytics.totalSessions || campaign.totalSessions || 0;
        const dbBounces = analytics.bouncedSessions || campaign.bouncedSessions || 0;
        
        if (dbTotalSessions > 0) {
          let targetTime = null;
          
          if (analytics.completedAt) {
            targetTime = new Date(analytics.completedAt);
          } else if (analytics.startedAt) {
            targetTime = new Date(analytics.startedAt);
          } else if (campaign.createdAt) {
            targetTime = new Date(campaign.createdAt);
          }
          
          if (targetTime) {
            const now = new Date();
            const chartIndex = this.getChartIndexForDateTime(targetTime, now);
            
            if (chartIndex >= 0 && chartIndex < 24) {
              timeSeries.visits[chartIndex] += dbTotalSessions;
              timeSeries.bounces[chartIndex] += dbBounces;
            }
          }
        }
      }
      
      return timeSeries;
    } catch (error) {
      console.error('❌ Error calculating chart time series:', error);
      return timeSeries;
    }
  }

  /**
   * Calculate source chart data using timestamps
   * @param {Array} campaigns - Campaign documents
   * @param {string} userEmail - User email for filtering
   * @returns {Object} Source data for charts
   */
  async calculateChartSourcesFromDatabase(campaigns, userEmail) {
    const sources = this.initializeChartData('sources');
    
    try {
      for (const campaign of campaigns) {
        const analytics = campaign.analytics || {};
        const dbTotalSessions = analytics.totalSessions || campaign.totalSessions || 0;
        
        if (dbTotalSessions > 0) {
          let targetTime = null;
          
          if (analytics.completedAt) {
            targetTime = new Date(analytics.completedAt);
          } else if (analytics.startedAt) {
            targetTime = new Date(analytics.startedAt);
          } else if (campaign.createdAt) {
            targetTime = new Date(campaign.createdAt);
          }
          
          if (targetTime) {
            const now = new Date();
            const chartIndex = this.getChartIndexForDateTime(targetTime, now);
            
            if (chartIndex >= 0 && chartIndex < 24) {
              const sourceData = this.getSourceDataForCampaign(analytics);

              sources.organic[chartIndex] += sourceData.organic;
              sources.direct[chartIndex] += sourceData.direct;
              sources.social[chartIndex] += sourceData.social;
              sources.referral[chartIndex] += sourceData.referral;
            }
          }
        }
      }
      
      return sources;
    } catch (error) {
      console.error('❌ Error calculating chart sources:', error);
      return sources;
    }
  }

  /**
   * Get session data (live activity or history)
   * @param {number} limit - Maximum sessions to return
   * @param {string} userEmail - User email for filtering
   * @param {string} type - 'live' for recent active sessions, 'history' for all sessions
   * @returns {Array} Session objects
   */
  async getSessionData(limit = 50, userEmail, type = 'history') {
    try {
      const user = await User.findOne({ email: userEmail }).populate({
        path: 'campaigns',
        match: type === 'live' ? { isActive: true } : {}
      });
      
      if (!user || !user.campaigns) {
        return [];
      }

      const campaigns = user.campaigns;
      const allSessions = [];
      
      for (const campaign of campaigns) {
        const rawLogs = await this.getRawLogsFromSQLite(campaign._id.toString(), userEmail);
        
        // Filter out debug logs for live sessions
        const filteredLogs = type === 'live' 
          ? rawLogs.filter(log => log.level && log.level.toLowerCase() !== 'debug')
          : rawLogs;
        
        const sessions = this.extractSessionsFromLogs(filteredLogs);
        
        let filteredSessions = sessions;
        if (type === 'live') {
          filteredSessions = sessions.filter(session => {
            const lastActivity = new Date(session.endTime);
            const now = new Date();
            return (now - lastActivity) < 10 * 60 * 1000; // 10 minutes
          });
        }
        
        filteredSessions.forEach(session => {
          session.campaignId = campaign._id.toString();
          session.campaignUrl = campaign.url;
          // Filter debug events for live sessions and sort in ascending order
          if (type === 'live') {
            session.events = session.events
              .filter(event => event.level && event.level.toLowerCase() !== 'debug')
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          }
        });
        
        allSessions.push(...filteredSessions);
      }
      
      const sortedSessions = allSessions.sort((a, b) => 
        new Date(b[type === 'live' ? 'endTime' : 'startTime']) - 
        new Date(a[type === 'live' ? 'endTime' : 'startTime'])
      ).slice(0, limit);
      
      if (type === 'live') {
        return sortedSessions.map(session => ({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          source: session.source,
          specificReferrer: session.referrer,
          proxy: session.proxy,
          duration: session.duration,
          campaignId: session.campaignId,
          campaignUrl: session.campaignUrl,
          events: session.events // All non-debug events
        }));
      } else {
        return sortedSessions.map(session => ({
          sessionId: session.id,
          time: new Date(session.startTime).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
          status: this.formatStatus(session.status),
          source: session.source.charAt(0).toUpperCase() + session.source.slice(1),
          specificReferrer: session.referrer || 'Direct',
          duration: `${session.duration}s`,
          proxy: session.proxy || 'No Proxy',
          campaignUrl: session.campaignUrl || 'Unknown'
        }));
      }
      
    } catch (error) {
      console.error(`❌ Error getting ${type} session data:`, error);
      return [];
    }
  }

  /**
   * Get live session activity (recent active sessions)
   * @param {number} limit - Maximum sessions to return
   * @param {string} userEmail - User email for filtering
   * @returns {Array} Live session objects with filtered logs
   */
  async getLiveSessionActivity(limit = 10, userEmail) {
    try {
      const user = await User.findOne({ email: userEmail }).populate({
        path: 'campaigns',
        match: { isActive: true }
      });
      
      if (!user || !user.campaigns) {
        return [];
      }

      const campaigns = user.campaigns;
      const allSessions = [];
      
      for (const campaign of campaigns) {
        const rawLogs = await this.getRawLogsFromSQLite(campaign._id.toString(), userEmail);
        
        // Filter out debug logs
        const filteredLogs = rawLogs.filter(log => 
          log.level && log.level.toLowerCase() !== 'debug'
        );
        
        const sessions = this.extractSessionsFromLogs(filteredLogs);
        
        const recentSessions = sessions.filter(session => {
          const lastActivity = new Date(session.endTime);
          const now = new Date();
          return (now - lastActivity) < 10 * 60 * 1000; // 10 minutes
        });
        
        recentSessions.forEach(session => {
          session.campaignId = campaign._id.toString();
          session.campaignUrl = campaign.url;
          // Filter out debug events from session events and sort in ascending order
          session.events = session.events
            .filter(event => event.level && event.level.toLowerCase() !== 'debug')
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        });
        
        allSessions.push(...recentSessions);
      }
      
      return allSessions
        .sort((a, b) => new Date(b.endTime) - new Date(a.endTime))
        .slice(0, limit)
        .map(session => ({
          id: session.id,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
          source: session.source,
          specificReferrer: session.referrer,
          proxy: session.proxy,
          duration: session.duration,
          campaignId: session.campaignId,
          campaignUrl: session.campaignUrl,
          events: session.events // All non-debug events
        }));
      
    } catch (error) {
      console.error('❌ Error getting live session activity:', error);
      return [];
    }
  }

  /**
   * Get session history for table display
   * @param {number} limit - Maximum sessions to return
   * @param {string} userEmail - User email for filtering
   * @returns {Array} Session history objects
   */
  async getSessionHistory(limit = 50, userEmail) {
    return this.getSessionData(limit, userEmail, 'history');
  }

  /**
   * Get analytics for a specific campaign
   * @param {string} campaignId - Campaign ID
   * @param {string} userEmail - User email
   * @returns {Object} Campaign analytics
   */
  async getCampaignAnalytics(campaignId, userEmail) {
    try {
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      
      if (!user || !user.campaigns) {
        throw new Error(`No campaigns found for user ${userEmail}`);
      }

      const campaign = user.campaigns.find(c => c._id.toString() === campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found for user ${userEmail}`);
      }
      
      // Return campaign analytics directly from database
      const analytics = campaign.analytics || {};
      return {
        campaign: {
          id: campaign._id,
          url: campaign.url,
          isActive: campaign.isActive,
          status: campaign.status || (campaign.isActive ? 'active' : 'inactive'),
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt
        },
        totalSessions: analytics.totalSessions || campaign.totalSessions || 0,
        activeSessions: analytics.activeSessions || 0,
        completedSessions: analytics.completedSessions || campaign.completedSessions || 0,
        bouncedSessions: analytics.bouncedSessions || campaign.bouncedSessions || 0,
        erroredSessions: analytics.erroredSessions || 0,
        avgDuration: analytics.avgDuration || campaign.avgDuration || 0,
        mobileCount: analytics.devices?.mobile || 0,
        desktopCount: analytics.devices?.desktop || 0,
        sessionCount: analytics.totalSessions || campaign.totalSessions || 0,
        totalDuration: analytics.totalDuration || (analytics.totalSessions * analytics.avgDuration) || 0,
        efficiency: analytics.efficiency || 0,
        bounceRate: analytics.bounceRate || 0,
        dataSource: 'database'
      };
    } catch (error) {
      console.error(`❌ Error getting campaign analytics for ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Get chart index for date+time relative to current time
   * @param {Date} targetDateTime - Target date and time
   * @param {Date} currentDateTime - Current date and time
   * @returns {number} Chart index (0-23, where 23 is current hour)
   */
  getChartIndexForDateTime(targetDateTime, currentDateTime) {
    const hoursDiff = Math.floor((targetDateTime - currentDateTime) / (60 * 60 * 1000));
    const index = 23 + hoursDiff;
    return Math.max(0, Math.min(23, index));
  }

  /**
   * Get source data for a campaign from database analytics only
   * @param {Object} campaign - Campaign document
   * @param {Object} analytics - Analytics data from campaign
   * @param {number} totalSessions - Total sessions (unused, kept for compatibility)
   * @returns {Object} Source distribution from database
   */
  getSourceDataForCampaign(analytics) {
    // Use only database analytics sources
    const sources = analytics.sources || {};
    return {
      organic: sources.organic || 0,
      direct: sources.direct || 0,
      social: sources.social || 0,
      referral: sources.referral || 0
    };
  }

  // Helper methods

  initializeChartData(type = 'timeSeries') {
    const hours = Array.from({ length: 24 }, (_, i) => {
      const hour = new Date();
      hour.setHours(hour.getHours() - (23 - i), 0, 0, 0);
      return hour.getHours().toString().padStart(2, '0') + ':00';
    });
    
    if (type === 'timeSeries') {
      return {
        labels: hours,
        visits: new Array(24).fill(0),
        bounces: new Array(24).fill(0)
      };
    } else {
      return {
        labels: hours,
        organic: new Array(24).fill(0),
        direct: new Array(24).fill(0),
        social: new Array(24).fill(0),
        referral: new Array(24).fill(0)
      };
    }
  }

  // Utilities
  calculatePercentage(part, total) {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }

  formatStatus(status) {
    const statusMap = {
      'completed': 'Completed',
      'bounced': 'Bounced',
      'timeout': 'Timeout',
      'error': 'Error',
      'active': 'Active'
    };
    return statusMap[status] || 'Unknown';
  }

  getEmptyAnalytics() {
    return {
      overview: {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        bouncedSessions: 0,
        erroredSessions: 0,
        avgDuration: 0,
        mobileCount: 0,
        desktopCount: 0,
        bounceRate: 0,
        totalVisits: 0,
        totalCampaigns: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        efficiency: 0,
        userDashboard: null
      },
      timeSeries: this.initializeChartData('timeSeries'),
      sources: this.initializeChartData('sources'),
      campaigns: {}
    };
  }

  getEmptyCampaignAnalytics(campaign) {
    return {
      campaign: {
        id: campaign._id,
        url: campaign.url,
        isActive: campaign.isActive,
        status: campaign.status || 'inactive'
      },
      totalSessions: 0,
      activeSessions: 0,
      completedSessions: 0,
      bouncedSessions: 0,
      erroredSessions: 0,
      sessionCount: 0,
      totalDuration: 0,
      avgDuration: 0,
      mobileCount: 0,
      desktopCount: 0,
      sessions: []
    };
  }
}

// Create and export singleton instance
const trafficAnalytics = new TrafficAnalytics();

module.exports = trafficAnalytics;
