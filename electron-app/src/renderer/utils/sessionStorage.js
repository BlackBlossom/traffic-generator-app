/**
 * Client-side session timestamp storage utility
 * Stores visit and bounce timestamps in localStorage for accurate chart generation
 */

const STORAGE_KEYS = {
  SESSIONS: 'traffic_sessions',
  BOUNCES: 'traffic_bounces',
  SOURCES: 'traffic_sources'
};

// Maximum entries to keep (last 24 hours worth)
const MAX_ENTRIES = 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

class SessionStorage {
  /**
   * Record a new session visit
   * @param {Object} sessionData - Session information
   */
  recordVisit(sessionData) {
    const timestamp = Date.now();
    const visit = {
      timestamp,
      sessionId: sessionData.sessionId || `session_${timestamp}`,
      source: sessionData.source || 'direct',
      campaignId: sessionData.campaignId,
      campaignUrl: sessionData.campaignUrl,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    };

    this.addToStorage(STORAGE_KEYS.SESSIONS, visit);
  }

  /**
   * Record a bounce (session that left quickly)
   * @param {string} sessionId - Session ID that bounced
   * @param {Object} bounceData - Additional bounce information
   */
  recordBounce(sessionId, bounceData = {}) {
    const timestamp = Date.now();
    const bounce = {
      timestamp,
      sessionId,
      reason: bounceData.reason || 'quick_exit',
      duration: bounceData.duration || 0
    };

    this.addToStorage(STORAGE_KEYS.BOUNCES, bounce);
  }

  /**
   * Record traffic source data
   * @param {Object} sourceData - Source information
   */
  recordSource(sourceData) {
    const timestamp = Date.now();
    const source = {
      timestamp,
      type: sourceData.type || 'direct', // organic, direct, social, referral
      referrer: sourceData.referrer,
      campaign: sourceData.campaign
    };

    this.addToStorage(STORAGE_KEYS.SOURCES, source);
  }

  /**
   * Add data to localStorage with cleanup
   * @param {string} key - Storage key
   * @param {Object} data - Data to store
   */
  addToStorage(key, data) {
    try {
      let existing = JSON.parse(localStorage.getItem(key) || '[]');
      
      // Add new data
      existing.push(data);
      
      // Remove old entries (older than 24 hours)
      const cutoff = Date.now() - TWENTY_FOUR_HOURS;
      existing = existing.filter(item => item.timestamp > cutoff);
      
      // Limit total entries
      if (existing.length > MAX_ENTRIES) {
        existing = existing.slice(-MAX_ENTRIES);
      }
      
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (error) {
      console.error('Failed to store session data:', error);
    }
  }

  /**
   * Generate time series data from stored sessions
   * @param {number} hours - Number of hours to include (default 24)
   * @returns {Object} Chart data with visits and bounces
   */
  generateTimeSeriesData(hours = 24) {
    const now = Date.now();
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
    const bounces = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOUNCES) || '[]');
    
    // Create hourly buckets
    const labels = [];
    const visits = new Array(hours).fill(0);
    const bounceData = new Array(hours).fill(0);
    
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now - (i * 60 * 60 * 1000));
      labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    // Count visits per hour
    sessions.forEach(session => {
      const hourDiff = Math.floor((now - session.timestamp) / (60 * 60 * 1000));
      if (hourDiff >= 0 && hourDiff < hours) {
        const index = hours - 1 - hourDiff;
        visits[index]++;
      }
    });
    
    // Count bounces per hour
    bounces.forEach(bounce => {
      const hourDiff = Math.floor((now - bounce.timestamp) / (60 * 60 * 1000));
      if (hourDiff >= 0 && hourDiff < hours) {
        const index = hours - 1 - hourDiff;
        bounceData[index]++;
      }
    });
    
    return { labels, visits, bounces: bounceData };
  }

  /**
   * Generate traffic source data from stored sources
   * @param {number} hours - Number of hours to include (default 24)
   * @returns {Object} Chart data with source breakdown
   */
  generateSourceData(hours = 24) {
    const now = Date.now();
    const sources = JSON.parse(localStorage.getItem(STORAGE_KEYS.SOURCES) || '[]');
    
    // Create hourly buckets
    const labels = [];
    const organic = new Array(hours).fill(0);
    const direct = new Array(hours).fill(0);
    const social = new Array(hours).fill(0);
    const referral = new Array(hours).fill(0);
    
    for (let i = hours - 1; i >= 0; i--) {
      const time = new Date(now - (i * 60 * 60 * 1000));
      labels.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }
    
    // Count sources per hour
    sources.forEach(source => {
      const hourDiff = Math.floor((now - source.timestamp) / (60 * 60 * 1000));
      if (hourDiff >= 0 && hourDiff < hours) {
        const index = hours - 1 - hourDiff;
        
        switch (source.type) {
          case 'organic':
            organic[index]++;
            break;
          case 'direct':
            direct[index]++;
            break;
          case 'social':
            social[index]++;
            break;
          case 'referral':
            referral[index]++;
            break;
        }
      }
    });
    
    return { labels, organic, direct, social, referral };
  }

  /**
   * Clear all stored session data
   */
  clearAll() {
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.BOUNCES);
    localStorage.removeItem(STORAGE_KEYS.SOURCES);
  }

  /**
   * Get session statistics
   * @returns {Object} Session stats
   */
  getStats() {
    const sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
    const bounces = JSON.parse(localStorage.getItem(STORAGE_KEYS.BOUNCES) || '[]');
    
    const cutoff = Date.now() - TWENTY_FOUR_HOURS;
    const recentSessions = sessions.filter(s => s.timestamp > cutoff);
    const recentBounces = bounces.filter(b => b.timestamp > cutoff);
    
    return {
      totalSessions: recentSessions.length,
      totalBounces: recentBounces.length,
      bounceRate: recentSessions.length > 0 ? Math.round((recentBounces.length / recentSessions.length) * 100) : 0
    };
  }
}

// Create singleton instance
const sessionStorage = new SessionStorage();

export default sessionStorage;
