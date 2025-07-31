// src/renderer/api/analytics.js - Updated for IPC communication
// Helper to get user email from localStorage
function getUserEmail() {
  return localStorage.getItem('rst_user_email');
}

export const analyticsAPI = {
  /**
   * Get SEO analytics overview data
   */
  async getOverview(campaignIds = null, apiKey = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-analytics-overview', userEmail, campaignIds);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get analytics overview');
      }
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
      throw error;
    }
  },

  /**
   * Get live session activity
   */
  async getLiveSessions(limit = 10, apiKey = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-live-sessions', userEmail, limit);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get live sessions');
      }
    } catch (error) {
      console.error('Error fetching live sessions:', error);
      throw error;
    }
  },

  /**
   * Get session history
   */
  async getSessionHistory(limit = 50, apiKey = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-session-history', userEmail, limit);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get session history');
      }
    } catch (error) {
      console.error('Error fetching session history:', error);
      // Return empty array as fallback to prevent UI errors
      return [];
    }
  },

  /**
   * Get analytics for a specific campaign
   */
  async getCampaignAnalytics(campaignId, apiKey = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-campaign-analytics', userEmail, campaignId);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get campaign analytics');
      }
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
      throw error;
    }
  },

  /**
   * Get quick stats
   */
  async getStats(apiKey = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-user-stats', userEmail);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get stats');
      }
    } catch (error) {
      console.error('Error fetching analytics stats:', error);
      throw error;
    }
  }
};
