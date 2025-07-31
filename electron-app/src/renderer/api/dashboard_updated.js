// api/dashboard.js - Updated to use IPC instead of HTTP API
// This is an example of how to migrate from HTTP API to IPC

export const dashboardAPI = {
  /**
   * Get dashboard analytics
   * @param {string} email - User's email
   * @returns {Promise<Object>} Dashboard analytics data
   */
  async getAnalytics(email) {
    try {
      const result = await window.electronAPI.getDashboardAnalytics(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch dashboard analytics');
      }

      return result.data;
    } catch (error) {
      console.error('Dashboard analytics API error:', error);
      throw error;
    }
  },

  /**
   * Refresh dashboard analytics
   * @param {string} email - User's email
   * @returns {Promise<Object>} Refreshed dashboard analytics data
   */
  async refreshAnalytics(email) {
    try {
      const result = await window.electronAPI.refreshDashboardAnalytics(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to refresh dashboard analytics');
      }

      return result.data;
    } catch (error) {
      console.error('Dashboard refresh API error:', error);
      throw error;
    }
  },

  /**
   * Get user statistics
   * @param {string} email - User's email
   * @returns {Promise<Object>} User statistics data
   */
  async getUserStats(email) {
    try {
      const result = await window.electronAPI.getUserStats(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch user statistics');
      }

      return result.data;
    } catch (error) {
      console.error('User stats API error:', error);
      throw error;
    }
  },

  /**
   * Get app health status
   * @returns {Promise<Object>} App health status
   */
  async getAppHealth() {
    try {
      const result = await window.electronAPI.getAppHealth();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch app health');
      }

      return result.data;
    } catch (error) {
      console.error('App health API error:', error);
      throw error;
    }
  }
};

// Export for backward compatibility
export default dashboardAPI;
