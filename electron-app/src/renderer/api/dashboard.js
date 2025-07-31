// api/dashboard.js - Updated for IPC communication

export const dashboardAPI = {
  /**
   * Get dashboard analytics
   * @param {string} apiKey - User's API key (not used in IPC)
   * @param {string} email - User's email
   * @returns {Promise<Object>} Dashboard analytics data
   */
  async getAnalytics(apiKey, email) {
    try {
      const result = await window.electronAPI.invoke('get-dashboard-analytics', email);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get dashboard analytics');
      }
    } catch (error) {
      console.error('Dashboard analytics API error:', error);
      throw error;
    }
  },

  /**
   * Refresh dashboard analytics
   * @param {string} apiKey - User's API key (not used in IPC)
   * @param {string} email - User's email
   * @returns {Promise<Object>} Refreshed dashboard analytics
   */
  async refresh(apiKey, email) {
    try {
      const result = await window.electronAPI.invoke('refresh-dashboard-analytics', email);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to refresh dashboard analytics');
      }
    } catch (error) {
      console.error('Dashboard refresh API error:', error);
      throw error;
    }
  },

  /**
   * Get quick dashboard stats
   * @param {string} apiKey - User's API key (not used in IPC)
   * @param {string} email - User's email
   * @returns {Promise<Object>} Quick stats data
   */
  async getQuickStats(apiKey, email) {
    try {
      const result = await window.electronAPI.invoke('get-user-stats', email);
      if (result.success) {
        return result.data;
      } else {
        throw new Error(result.error || 'Failed to get user stats');
      }
    } catch (error) {
      console.error('Quick stats API error:', error);
      throw error;
    }
  },
};