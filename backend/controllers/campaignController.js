const User = require('../models/User');        // Adjust path as needed
const Campaigns = require('../models/Campaigns'); // Adjust path as needed
const { campaignTrafficController } = require('./campaignTrafficController'); // adjust path as needed
const userSockets = require('../services/userSockets'); // Adjust the path as needed
const redisLogger = require('../services/redisLogger'); // Redis logging service
const campaignAnalytics = require('../services/campaignAnalytics'); // Campaign analytics service
const dashboardAnalytics = require('../services/dashboardAnalytics'); // Dashboard analytics service

// GET /api/users/:email/campaigns
exports.getUserCampaigns = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email }).populate('campaigns');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.campaigns);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/users/:email/campaigns

// Create a Campaign with Scheduling Logic and Real-Time WebSocket Logging
exports.createCampaign = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const body = { ...req.body };
    body.isActive = !body.scheduling; // isActive: true if no scheduling, false if scheduled

    const campaign = new Campaigns(body);
    await campaign.save();

    user.campaigns.push(campaign._id);
    await user.save();

    if (!campaign.scheduling && campaign.isActive) {
      // Initialize campaign analytics in database
      await campaignAnalytics.initializeCampaignAnalytics(campaign._id);
      
      // Get the user's WebSocket (if connected and authenticated)
      const ws = userSockets.get(user.email);
      if (ws) {
        campaignTrafficController(campaign.toObject(), ws, user.email); // Pass ws and userEmail for user-specific logs
      } else {
        // Optionally log or handle if user is not connected via WebSocket
        console.warn(`User ${user.email} not connected via WebSocket. Skipping real-time logs.`);
        // You may choose to start the controller without logs or handle differently
        campaign.isActive = false; // Ensure campaign is marked inactive
        await campaign.save(); // Save the campaign state
        return res.status(202).json({ message: 'Campaign created but not started (WebSocket not connected).' });
      }
    }

    // Update dashboard analytics after campaign creation
    await dashboardAnalytics.updateOnCampaignChange(user.email);

    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// POST /api/users/:email/campaigns/:campaignId/stop
// Secure Stop: Only campaign owner can stop
exports.stopCampaign = async (req, res) => {
  try {
    const { email, campaignId } = req.params;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(campaignId)) {
      return res.status(403).json({ error: 'You can stop only your own campaigns.' });
    }

    const campaign = await Campaigns.findById(campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    campaign.isActive = false;
    await campaign.save();

    // Finalize campaign analytics with any remaining Redis logs
    await campaignAnalytics.finalizeCampaignAnalytics(campaignId);

    // Update dashboard analytics after campaign stop
    await dashboardAnalytics.updateOnCampaignChange(user.email);

    res.json({ message: 'Campaign traffic stopped.', campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// PUT /api/users/:email/campaigns/:campaignId
exports.updateCampaign = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Ensure the campaign belongs to the user
    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    const campaign = await Campaigns.findByIdAndUpdate(
      req.params.campaignId,
      req.body,
      { new: true, runValidators: true }
    );
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    // Update dashboard analytics after campaign update
    await dashboardAnalytics.updateOnCampaignChange(user.email);

    res.json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/users/:email/campaigns/:campaignId
exports.getSingleCampaign = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    const campaign = await Campaigns.findById(req.params.campaignId);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    res.json(campaign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/users/:email/campaigns/:campaignId
exports.deleteCampaign = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    // Finalize analytics before deletion to preserve final stats
    await campaignAnalytics.finalizeCampaignAnalytics(req.params.campaignId);
    
    await Campaigns.findByIdAndDelete(req.params.campaignId);
    user.campaigns = user.campaigns.filter(
      id => id.toString() !== req.params.campaignId
    );
    await user.save();

    // Clear campaign logs from Redis when deleting campaign
    await redisLogger.clearLogs(req.params.campaignId, user.email);

    // Update dashboard analytics after campaign deletion
    await dashboardAnalytics.updateOnCampaignChange(user.email);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:email/campaigns/:campaignId/logs
exports.getCampaignLogs = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    const limit = parseInt(req.query.limit) || 200;
    const logs = await redisLogger.fetchLogs(req.params.campaignId, user.email, limit);
    const logCount = await redisLogger.getLogCount(req.params.campaignId, user.email);

    res.json({ 
      campaignId: req.params.campaignId,
      logs: logs,
      totalCount: logCount,
      fetched: logs.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/users/:email/campaigns/:campaignId/logs
exports.clearCampaignLogs = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    await redisLogger.clearLogs(req.params.campaignId, user.email);
    res.json({ message: 'Campaign logs cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:email/campaigns/:campaignId/analytics
exports.getCampaignAnalytics = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.campaigns.map(id => id.toString()).includes(req.params.campaignId)) {
      return res.status(403).json({ error: 'Campaign does not belong to user' });
    }

    const analytics = await campaignAnalytics.getCampaignReport(req.params.campaignId);
    res.json({ 
      campaignId: req.params.campaignId,
      analytics: analytics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:email/logs/stats - Get user's log statistics
exports.getUserLogStats = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const stats = await redisLogger.getUserLogStats(user.email);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/users/:email/logs/global - Get user's global logs across all campaigns
exports.getUserGlobalLogs = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const limit = parseInt(req.query.limit) || 100;
    const logs = await redisLogger.getUserGlobalLogs(user.email, limit);
    const totalCount = await redisLogger.getUserTotalLogCount(user.email);

    res.json({
      userEmail: user.email,
      logs: logs,
      totalCount: totalCount,
      fetched: logs.length,
      limit: limit
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/users/:email/logs/clear - Clear all logs for a user
exports.clearUserLogs = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await redisLogger.clearUserLogs(user.email);
    res.json({ message: 'All user logs cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
