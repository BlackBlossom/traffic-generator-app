// routes/dashboard.js
const express = require('express');
const router = express.Router();
const dashboardAnalytics = require('../services/dashboardAnalytics');
const apiKeyAuth = require('../middleware/apiKeyAuth');

/**
 * GET /api/dashboard/:email/analytics
 * Get dashboard analytics for authenticated user
 */
router.get('/:email/analytics', apiKeyAuth, async (req, res) => {
  try {
    const userEmail = req.params.email;
    
    const analytics = await dashboardAnalytics.getDashboardAnalytics(userEmail);
    
    res.json({
      success: true,
      data: analytics
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard analytics',
      error: error.message
    });
  }
});

/**
 * POST /api/dashboard/:email/refresh
 * Force refresh dashboard analytics
 */
router.post('/:email/refresh', apiKeyAuth, async (req, res) => {
  try {
    const userEmail = req.params.email;
    
    const analytics = await dashboardAnalytics.getDashboardAnalytics(userEmail);
    
    res.json({
      success: true,
      data: analytics,
      message: 'Dashboard analytics refreshed successfully'
    });
    
  } catch (error) {
    console.error('Dashboard refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh dashboard analytics',
      error: error.message
    });
  }
});

/**
 * GET /api/dashboard/:email/quick-stats
 * Get quick dashboard statistics
 */
router.get('/:email/quick-stats', apiKeyAuth, async (req, res) => {
  try {
    const userEmail = req.params.email;
    
    // Get basic stats without full analytics calculation
    const User = require('../models/User');
    const user = await User.findOne({ email: userEmail }).populate('campaigns');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const campaigns = user.campaigns || [];
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'running').length;
    
    // Calculate basic metrics
    const totalVisits = campaigns.reduce((sum, c) => sum + (c.analytics?.totalVisits || 0), 0);
    const totalBounce = campaigns.reduce((sum, c) => sum + (c.analytics?.bounceRate || 0), 0);
    const avgBounceRate = totalCampaigns > 0 ? totalBounce / totalCampaigns : 0;
    
    res.json({
      success: true,
      data: {
        totalCampaigns,
        activeCampaigns,
        totalVisits,
        avgBounceRate: Math.round(avgBounceRate * 100) / 100,
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    console.error('Quick stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get quick stats',
      error: error.message
    });
  }
});

module.exports = router;
