// trafficHandlers.js - IPC handlers for traffic operations
const { ipcMain } = require('electron');
const { campaignTrafficController } = require('../controllers/campaignTrafficController');
const Campaigns = require('../models/Campaigns');
const User = require('../models/User');
const logEventHub = require('../services/logEventHub');
const sqliteLogger = require('../services/sqliteLogger');

/**
 * Initialize all traffic-related IPC handlers
 */
function initializeTrafficHandlers() {
  
  // Start traffic for a campaign
  ipcMain.handle('start-campaign-traffic', async (event, userEmail, campaignId) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!campaign.isActive) {
        throw new Error('Campaign is not active');
      }

      // Start traffic controller
      const result = await campaignTrafficController(campaign.toObject(), null, userEmail);
      
      await logEventHub.logFromMain(
        campaignId,
        userEmail,
        `Traffic started for campaign: ${campaign.name || campaignId}`,
        'info'
      );

      return { 
        success: true, 
        message: 'Campaign traffic started successfully',
        data: result 
      };
    } catch (error) {
      console.error('❌ start-campaign-traffic error:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop traffic for a campaign
  ipcMain.handle('stop-campaign-traffic', async (event, userEmail, campaignId) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update campaign status
      campaign.isActive = false;
      campaign.updatedAt = new Date();
      await campaign.save();

      await logEventHub.logFromMain(
        campaignId,
        userEmail,
        `Traffic stopped for campaign: ${campaign.name || campaignId}`,
        'warn'
      );

      return { 
        success: true, 
        message: 'Campaign traffic stopped successfully' 
      };
    } catch (error) {
      console.error('❌ stop-campaign-traffic error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get traffic status for a campaign
  ipcMain.handle('get-traffic-status', async (event, userEmail, campaignId) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const status = {
        campaignId: campaign._id,
        name: campaign.name,
        isActive: campaign.isActive,
        status: campaign.status,
        concurrent: campaign.concurrent,
        totalSessions: campaign.totalSessions,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt
      };

      return { success: true, data: status };
    } catch (error) {
      console.error('❌ get-traffic-status error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get active traffic campaigns for a user
  ipcMain.handle('get-active-traffic-campaigns', async (event, userEmail) => {
    try {
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        throw new Error('User not found');
      }

      // Filter only active campaigns
      const activeCampaigns = user.campaigns
        .filter(campaign => campaign.isActive)
        .map(campaign => ({
          _id: campaign._id,
          name: campaign.name,
          url: campaign.url,
          concurrent: campaign.concurrent,
          status: campaign.status,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt
        }));

      return { success: true, data: activeCampaigns };
    } catch (error) {
      console.error('❌ get-active-traffic-campaigns error:', error);
      return { success: false, error: error.message };
    }
  });

  // Pause/Resume traffic for a campaign
  ipcMain.handle('pause-resume-traffic', async (event, userEmail, campaignId, pause = true) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update campaign status
      campaign.status = pause ? 'paused' : 'active';
      campaign.updatedAt = new Date();
      await campaign.save();

      const action = pause ? 'paused' : 'resumed';
      await logEventHub.logFromMain(
        campaignId,
        userEmail,
        `Traffic ${action} for campaign: ${campaign.name || campaignId}`,
        'info'
      );

      return { 
        success: true, 
        message: `Campaign traffic ${action} successfully`,
        data: { status: campaign.status }
      };
    } catch (error) {
      console.error('❌ pause-resume-traffic error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get traffic session details
  ipcMain.handle('get-traffic-session-details', async (event, userEmail, campaignId, limit = 10) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      // Get session details from indexed DB logger
      const sessionDetails = await sqliteLogger.getCampaignLogs(campaignId, limit);
      
      return { 
        success: true, 
        data: sessionDetails 
      };
    } catch (error) {
      console.error('❌ get-traffic-session-details error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Traffic IPC handlers initialized');
}

module.exports = { initializeTrafficHandlers };