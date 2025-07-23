// src/renderer/services/LoggingAPI.js

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class LoggingAPI {
  constructor() {
    this.baseURL = `${API_URL}/api/auth`;
  }

  // Helper to get authentication headers
  getHeaders(apiKey) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    };
  }

  // Fetch campaign logs via REST API
  async fetchCampaignLogs(userEmail, campaignId, apiKey, limit = 200) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${encodeURIComponent(userEmail)}/campaigns/${campaignId}/logs`,
        {
          headers: this.getHeaders(apiKey),
          params: { limit }
        }
      );

      return {
        success: true,
        logs: response.data.logs || [],
        count: response.data.count || 0
      };
    } catch (error) {
      console.error('Failed to fetch campaign logs:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Clear campaign logs via REST API
  async clearCampaignLogs(userEmail, campaignId, apiKey) {
    try {
      const response = await axios.delete(
        `${this.baseURL}/users/${encodeURIComponent(userEmail)}/campaigns/${campaignId}/logs`,
        {
          headers: this.getHeaders(apiKey)
        }
      );

      return {
        success: true,
        message: response.data.message || 'Logs cleared successfully'
      };
    } catch (error) {
      console.error('Failed to clear campaign logs:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Get campaign details
  async getCampaignDetails(userEmail, campaignId, apiKey) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${encodeURIComponent(userEmail)}/campaigns/${campaignId}`,
        {
          headers: this.getHeaders(apiKey)
        }
      );

      return {
        success: true,
        campaign: response.data
      };
    } catch (error) {
      console.error('Failed to get campaign details:', error);
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  // Test API connection
  async testConnection(userEmail, apiKey) {
    try {
      const response = await axios.get(
        `${this.baseURL}/users/${encodeURIComponent(userEmail)}/campaigns`,
        {
          headers: this.getHeaders(apiKey),
          timeout: 5000
        }
      );

      return {
        success: true,
        message: 'API connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }
}

export default new LoggingAPI();
