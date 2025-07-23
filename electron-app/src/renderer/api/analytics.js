// src/renderer/api/analytics.js
import { authFetch } from './auth';

const API_BASE_URL = 'http://localhost:5000/api';

export const analyticsAPI = {
  /**
   * Get traffic analytics overview data
   */
  async getOverview(campaignIds = null, apiKey = null) {
    try {
      const params = campaignIds ? `?campaignIds=${campaignIds.join(',')}` : '';
      const response = await authFetch(`${API_BASE_URL}/analytics/overview${params}`, {}, apiKey);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data;
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
      const response = await authFetch(`${API_BASE_URL}/analytics/live-sessions?limit=${limit}`, {}, apiKey);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data;
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
      const response = await authFetch(`${API_BASE_URL}/analytics/session-history?limit=${limit}`, {}, apiKey);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching session history:', error);
      throw error;
    }
  },

  /**
   * Get analytics for a specific campaign
   */
  async getCampaignAnalytics(campaignId, apiKey = null) {
    try {
      const response = await authFetch(`${API_BASE_URL}/analytics/campaign/${campaignId}`, {}, apiKey);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data;
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
      const response = await authFetch(`${API_BASE_URL}/analytics/stats`, {}, apiKey);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data;
    } catch (error) {
      console.error('Error fetching analytics stats:', error);
      throw error;
    }
  }
};
