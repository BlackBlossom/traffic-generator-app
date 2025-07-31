// campaignHandlers.js - IPC handlers for campaign operations
const { ipcMain } = require('electron');
const User = require('../models/User');
const Campaigns = require('../models/Campaigns');
const { campaignTrafficController } = require('../controllers/campaignTrafficController');
const campaignAnalytics = require('../services/campaignAnalytics');
const dashboardAnalytics = require('../services/dashboardAnalytics');
const logEventHub = require('../services/logEventHub');

/**
 * Initialize all campaign-related IPC handlers
 */
function initializeCampaignHandlers() {
  
  // Get user campaigns
  ipcMain.handle('get-user-campaigns', async (event, userEmail) => {
    try {
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        throw new Error('User not found');
      }
      
      // Convert Mongoose documents to plain objects for IPC serialization
      const plainCampaigns = user.campaigns.map(campaign => {
        const obj = campaign.toObject();
        // Remove any potentially problematic fields
        delete obj.__v;
        return JSON.parse(JSON.stringify(obj));
      });
      
      return { success: true, data: plainCampaigns };
    } catch (error) {
      console.error('❌ get-user-campaigns error:', error);
      return { success: false, error: error.message };
    }
  });

  // Create new campaign
  ipcMain.handle('create-campaign', async (event, userEmail, campaignData) => {
    try {
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Validate scheduling if enabled
      if (campaignData.scheduling) {
        const { startDate, startTime, endDate, endTime } = campaignData;
        
        if (!startDate || !startTime || !endDate || !endTime) {
          throw new Error('All scheduling fields are required when scheduling is enabled');
        }
        
        const startDateTime = new Date(`${startDate}T${startTime}:00`);
        const endDateTime = new Date(`${endDate}T${endTime}:00`);
        const now = new Date();
        
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
          throw new Error('Invalid date/time format');
        }
        
        if (startDateTime <= now) {
          throw new Error('Start date/time must be in the future');
        }
        
        if (endDateTime <= startDateTime) {
          throw new Error('End date/time must be after start date/time');
        }
      }

      // Create campaign
      const body = { ...campaignData };
      
      // Set campaign status based on scheduling
      if (body.scheduling) {
        body.isActive = false;
        body.status = 'scheduled';
      } else {
        body.isActive = true;
        body.status = 'active';
      }

      const campaign = new Campaigns(body);
      await campaign.save();

      // Add to user's campaigns
      user.campaigns.push(campaign._id);
      await user.save();

      // Handle immediate vs scheduled campaigns
      if (!campaign.scheduling && campaign.isActive) {
        // Initialize campaign analytics in database
        try {
          await campaignAnalytics.initializeCampaignAnalytics(campaign._id);
        } catch (analyticsError) {
          console.warn('⚠️ Failed to initialize campaign analytics:', analyticsError.message);
        }
        
        // Start campaign traffic controller
        try { 
          const { campaignTrafficController } = require('../controllers/campaignTrafficController');
          // Note: In Electron, we don't have WebSocket like backend, so we handle this differently
          campaignTrafficController(campaign.toObject(), null, userEmail);
        } catch (trafficError) {
          console.warn('⚠️ Failed to start traffic controller:', trafficError.message);
          // Mark campaign as inactive if traffic controller fails
          campaign.isActive = false;
          await campaign.save();
        }
      } else if (campaign.scheduling) {
        // For scheduled campaigns, register with scheduler
        try {
          const campaignScheduler = require('../services/campaignScheduler');
          if (campaignScheduler && campaignScheduler.isInitialized) {
            await campaignScheduler.scheduleNewCampaign(campaign);
          }
        } catch (schedulerError) {
          console.warn('⚠️ Failed to schedule campaign:', schedulerError.message);
        }
      }

      // Update dashboard analytics after campaign creation
      try {
        await dashboardAnalytics.updateOnCampaignChange(userEmail);
      } catch (dashboardError) {
        console.warn('⚠️ Failed to update dashboard analytics:', dashboardError.message);
      }

      // Log campaign creation
      await logEventHub.logFromMain(
        campaign._id, 
        userEmail, 
        `Campaign "${campaign.name || campaign._id}" created successfully`, 
        'info'
      );

      // Convert to plain object for IPC serialization
      const plainCampaign = campaign.toObject();
      delete plainCampaign.__v;
      return { success: true, data: JSON.parse(JSON.stringify(plainCampaign)) };
    } catch (error) {
      console.error('❌ create-campaign error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get single campaign
  ipcMain.handle('get-campaign', async (event, userEmail, campaignId) => {
    try {
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

      const plainCampaign = campaign.toObject();
      delete plainCampaign.__v;
      return { success: true, data: JSON.parse(JSON.stringify(plainCampaign)) };
    } catch (error) {
      console.error('❌ get-campaign error:', error);
      return { success: false, error: error.message };
    }
  });

  // Update campaign
  ipcMain.handle('update-campaign', async (event, userEmail, campaignId, updateData) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign does not belong to user');
      }

      // Update campaign with validation
      const campaign = await Campaigns.findByIdAndUpdate(
        campaignId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      );
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Update dashboard analytics after campaign update
      try {
        await dashboardAnalytics.updateOnCampaignChange(userEmail);
      } catch (dashboardError) {
        console.warn('⚠️ Failed to update dashboard analytics:', dashboardError.message);
      }

      // Log update
      await logEventHub.logFromMain(
        campaignId, 
        userEmail, 
        `Campaign "${campaign.name || campaignId}" updated`, 
        'info'
      );

      const plainCampaign = campaign.toObject();
      delete plainCampaign.__v;
      return { success: true, data: JSON.parse(JSON.stringify(plainCampaign)) };
    } catch (error) {
      console.error('❌ update-campaign error:', error);
      return { success: false, error: error.message };
    }
  });

  // Delete campaign
  ipcMain.handle('delete-campaign', async (event, userEmail, campaignId) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
        throw new Error('Campaign does not belong to user');
      }

      // Get campaign for logging purposes
      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Finalize analytics before deletion to preserve final stats
      try {
        await campaignAnalytics.finalizeCampaignAnalytics(campaignId);
      } catch (analyticsError) {
        console.warn('⚠️ Failed to finalize campaign analytics:', analyticsError.message);
      }

      // Delete the campaign
      await Campaigns.findByIdAndDelete(campaignId);

      // Remove from user's campaigns array
      user.campaigns = user.campaigns.filter(
        id => id.toString() !== campaignId
      );
      await user.save();

      // Clear campaign logs when deleting campaign
      try {
        await logEventHub.clearCampaignLogs(campaignId, userEmail);
      } catch (logError) {
        console.warn('⚠️ Failed to clear campaign logs:', logError.message);
      }

      // Update dashboard analytics after campaign deletion
      try {
        await dashboardAnalytics.updateOnCampaignChange(userEmail);
      } catch (dashboardError) {
        console.warn('⚠️ Failed to update dashboard analytics:', dashboardError.message);
      }

      // Log deletion
      await logEventHub.logFromMain(
        campaignId, 
        userEmail, 
        `Campaign "${campaign.name || campaignId}" deleted`, 
        'warn'
      );

      return { success: true, message: 'Campaign deleted successfully' };
    } catch (error) {
      console.error('❌ delete-campaign error:', error);
      return { success: false, error: error.message };
    }
  });

  // Start/Stop campaign
  ipcMain.handle('toggle-campaign', async (event, userEmail, campaignId, isActive) => {
    try {
      // First, find the user and check if they own this campaign
      const user = await User.findOne({ email: userEmail });
      if (!user) {
        throw new Error('User not found');
      }

      // Check if the campaign belongs to this user
      if (!user.campaigns.includes(campaignId)) {
        throw new Error('Campaign not found or access denied');
      }

      // Now find and update the campaign
      const campaign = await Campaigns.findById(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      campaign.isActive = isActive;
      campaign.updatedAt = new Date();
      
      if (isActive) {
        campaign.startedAt = new Date();
      }

      await campaign.save();

      // Handle analytics and dashboard updates
      if (!isActive) {
        // When stopping campaign, finalize analytics with any remaining logs
        try {
          await campaignAnalytics.finalizeCampaignAnalytics(campaignId);
        } catch (analyticsError) {
          console.warn('⚠️ Failed to finalize campaign analytics:', analyticsError.message);
        }
      }

      // Update dashboard analytics after campaign state change
      try {
        await dashboardAnalytics.updateOnCampaignChange(userEmail);
      } catch (dashboardError) {
        console.warn('⚠️ Failed to update dashboard analytics:', dashboardError.message);
      }

      // Log status change
      const status = isActive ? 'started' : 'stopped';
      await logEventHub.logFromMain(
        campaignId, 
        userEmail, 
        `Campaign "${campaign.name || campaignId}" ${status}`, 
        'info'
      );

      const plainCampaign = campaign.toObject();
      delete plainCampaign.__v;
      return { success: true, data: JSON.parse(JSON.stringify(plainCampaign)) };
    } catch (error) {
      console.error('❌ toggle-campaign error:', error);
      return { success: false, error: error.message };
    }
  });

  // Get campaign analytics
  ipcMain.handle('get-campaign-analytics', async (event, userEmail, campaignId) => {
    try {
      const campaign = await Campaigns.findOne({ 
        _id: campaignId, 
        userEmail: userEmail 
      });
      
      if (!campaign) {
        throw new Error('Campaign not found or access denied');
      }

      const analytics = await campaignAnalytics.getCampaignAnalytics(campaignId);
      return { success: true, data: analytics };
    } catch (error) {
      console.error('❌ get-campaign-analytics error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Campaign IPC handlers initialized');
}

module.exports = { initializeCampaignHandlers };
