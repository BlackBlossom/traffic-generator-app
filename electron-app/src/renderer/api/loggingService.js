// loggingService.js - Logging operations IPC API

// Helper to get user email from localStorage
function getUserEmail() {
  return localStorage.getItem('rst_user_email');
}

export const loggingAPI = {
  /**
   * Get user global logs
   * @param {number} limit - Maximum number of logs to retrieve
   * @returns {Promise<Object>} User logs
   */
  async getUserGlobalLogs(limit = 100) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-user-global-logs', userEmail, limit);
      return result;
    } catch (error) {
      console.error('Error getting user global logs:', error);
      throw error;
    }
  },

  /**
   * Get logs for a specific campaign
   * @param {string} campaignId - Campaign ID
   * @param {number} limit - Maximum number of logs to retrieve
   * @returns {Promise<Object>} Campaign logs
   */
  async getCampaignLogs(campaignId, limit = 100) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      // Main handler expects: (campaignId, userEmail, limit)
      const result = await window.electronAPI.invoke('get-campaign-logs', campaignId, userEmail, limit);
      return result;
    } catch (error) {
      console.error('Error getting campaign logs:', error);
      throw error;
    }
  },

  /**
   * Clear user logs
   * @returns {Promise<Object>} Clear logs response
   */
  async clearUserLogs() {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('clear-user-logs', userEmail);
      return result;
    } catch (error) {
      console.error('Error clearing user logs:', error);
      throw error;
    }
  },

  /**
   * Clear logs for a specific campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Clear campaign logs response
   */
  async clearCampaignLogs(campaignId) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      // Main handler expects: (campaignId, userEmail)
      const result = await window.electronAPI.invoke('clear-campaign-logs', campaignId, userEmail);
      return result;
    } catch (error) {
      console.error('Error clearing campaign logs:', error);
      throw error;
    }
  },

  /**
   * Clear ALL logs from the database (system and campaign logs)
   * @returns {Promise<Object>} Operation result
   */
  async clearAllLogs() {
    try {
      const result = await window.electronAPI.invoke('clear-all-logs');
      return result;
    } catch (error) {
      console.error('Error clearing all logs:', error);
      throw error;
    }
  },

  /**
   * Get user log statistics
   * @returns {Promise<Object>} Log statistics
   */
  async getUserLogStats() {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-user-log-stats', userEmail);
      return result;
    } catch (error) {
      console.error('Error getting user log stats:', error);
      throw error;
    }
  },

  /**
   * Get campaign log count
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Log count
   */
  async getCampaignLogCount(campaignId) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      // Main handler expects: (campaignId, userEmail)
      const result = await window.electronAPI.invoke('get-campaign-log-count', campaignId, userEmail);
      return result;
    } catch (error) {
      console.error('Error getting campaign log count:', error);
      throw error;
    }
  },

  /**
   * Initialize campaign logs
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Initialize response
   */
  async initializeCampaignLogs(campaignId) {
    try {
      // Main handler only expects: (campaignId)
      const result = await window.electronAPI.invoke('initialize-campaign-logs', campaignId);
      return result;
    } catch (error) {
      console.error('Error initializing campaign logs:', error);
      throw error;
    }
  },

  /**
   * Get system logs
   * @param {number} limit - Maximum number of logs to retrieve
   * @returns {Promise<Object>} System logs
   */
  async getSystemLogs(limit = 100) {
    try {
      const result = await window.electronAPI.invoke('get-system-logs', limit);
      return result;
    } catch (error) {
      console.error('Error getting system logs:', error);
      throw error;
    }
  },

  /**
   * Check log database health
   * @returns {Promise<Object>} Database health status
   */
  async checkLogDbHealth() {
    try {
      const result = await window.electronAPI.invoke('check-log-db-health');
      return result;
    } catch (error) {
      console.error('Error checking log database health:', error);
      throw error;
    }
  },

  /**
   * Log message from renderer
   * @param {string} campaignId - Campaign ID (can be null for system logs)
   * @param {string} level - Log level (info, warn, error, debug)
   * @param {string} message - Log message
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Object>} Log response
   */
  async logFromRenderer(campaignId, level, message, metadata = {}) {
    try {
      const userEmail = getUserEmail();
      const logEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...metadata
      };
      
      // Main handler expects: (campaignId, userEmail, logEntry)
      const result = await window.electronAPI.invoke('log-from-renderer', campaignId, userEmail, logEntry);
      return result;
    } catch (error) {
      console.error('Error logging from renderer:', error);
      throw error;
    }
  },

  /**
   * Export campaign logs
   * @param {string} campaignId - Campaign ID
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<Object>} Export response
   */
  async exportCampaignLogs(campaignId, format = 'json') {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      // Main handler expects: (campaignId, userEmail, format)
      const result = await window.electronAPI.invoke('export-campaign-logs', campaignId, userEmail, format);
      return result;
    } catch (error) {
      console.error('Error exporting campaign logs:', error);
      throw error;
    }
  },

  /**
   * Get log statistics
   * @param {string} campaignId - Optional campaign ID for campaign-specific stats
   * @returns {Promise<Object>} Log statistics
   */
  async getLogStatistics(campaignId = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      // Main handler expects: (campaignId, userEmail)
      const result = await window.electronAPI.invoke('get-log-statistics', campaignId, userEmail);
      return result;
    } catch (error) {
      console.error('Error getting log statistics:', error);
      throw error;
    }
  },

  /**
   * Clean up logs from deleted campaigns (orphaned logs)
   * @returns {Promise<Object>} Cleanup result
   */
  async cleanupOrphanedLogs() {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('cleanup-orphaned-logs', userEmail);
      return result;
    } catch (error) {
      console.error('Error cleaning up orphaned logs:', error);
      throw error;
    }
  }
};
