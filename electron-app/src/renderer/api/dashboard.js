// api/dashboard.js
const API_BASE_URL = 'http://localhost:5000/api';

export const dashboardAPI = {
  /**
   * Get dashboard analytics
   * @param {string} apiKey - User's API key
   * @param {string} email - User's email
   * @returns {Promise<Object>} Dashboard analytics data
   */
  async getAnalytics(apiKey, email) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/${email}/analytics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch dashboard analytics');
      }

      return data.data;
    } catch (error) {
      console.error('Dashboard analytics API error:', error);
      throw error;
    }
  },

  /**
   * Refresh dashboard analytics
   * @param {string} apiKey - User's API key
   * @param {string} email - User's email
   * @returns {Promise<Object>} Refreshed dashboard analytics
   */
  async refresh(apiKey, email) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/${email}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to refresh dashboard analytics');
      }

      return data.data;
    } catch (error) {
      console.error('Dashboard refresh API error:', error);
      throw error;
    }
  },

  /**
   * Get quick dashboard stats
   * @param {string} apiKey - User's API key
   * @param {string} email - User's email
   * @returns {Promise<Object>} Quick stats data
   */
  async getQuickStats(apiKey, email) {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard/${email}/quick-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch quick stats');
      }

      return data.data;
    } catch (error) {
      console.error('Quick stats API error:', error);
      throw error;
    }
  },
};
