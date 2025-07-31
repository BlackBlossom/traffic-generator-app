// trafficService.js - Traffic generation IPC API

// Helper to get user email from localStorage
function getUserEmail() {
  return localStorage.getItem('rst_user_email');
}

export const trafficAPI = {
  /**
   * Start traffic generation for a campaign
   * @param {string} campaignId - Campaign ID
   * @param {Object} config - Traffic configuration
   * @returns {Promise<Object>} Start traffic response
   */
  async startCampaignTraffic(campaignId, config = {}) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('start-campaign-traffic', userEmail, campaignId, config);
      return result;
    } catch (error) {
      console.error('Error starting campaign traffic:', error);
      throw error;
    }
  },

  /**
   * Stop traffic generation for a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} Stop traffic response
   */
  async stopCampaignTraffic(campaignId) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('stop-campaign-traffic', userEmail, campaignId);
      return result;
    } catch (error) {
      console.error('Error stopping campaign traffic:', error);
      throw error;
    }
  },

  /**
   * Get traffic status for campaigns
   * @param {string} campaignId - Optional specific campaign ID
   * @returns {Promise<Object>} Traffic status
   */
  async getTrafficStatus(campaignId = null) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-traffic-status', userEmail, campaignId);
      return result;
    } catch (error) {
      console.error('Error getting traffic status:', error);
      throw error;
    }
  },

  /**
   * Get active traffic campaigns
   * @returns {Promise<Object>} Active campaigns
   */
  async getActiveTrafficCampaigns() {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-active-traffic-campaigns', userEmail);
      return result;
    } catch (error) {
      console.error('Error getting active traffic campaigns:', error);
      throw error;
    }
  },

  /**
   * Pause or resume traffic generation
   * @param {string} campaignId - Campaign ID
   * @param {boolean} pause - True to pause, false to resume
   * @returns {Promise<Object>} Pause/resume response
   */
  async pauseResumeTraffic(campaignId, pause) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('pause-resume-traffic', userEmail, campaignId, pause);
      return result;
    } catch (error) {
      console.error('Error pausing/resuming traffic:', error);
      throw error;
    }
  },

  /**
   * Get traffic session details
   * @param {string} campaignId - Campaign ID
   * @param {number} limit - Maximum number of session details to retrieve
   * @returns {Promise<Object>} Session details
   */
  async getTrafficSessionDetails(campaignId, limit = 10) {
    try {
      const userEmail = getUserEmail();
      if (!userEmail) {
        throw new Error('User email not found. Please log in again.');
      }
      
      const result = await window.electronAPI.invoke('get-traffic-session-details', userEmail, campaignId, limit);
      return result;
    } catch (error) {
      console.error('Error getting traffic session details:', error);
      throw error;
    }
  }
};