// routes/analytics.js
const express = require('express');
const router = express.Router();
const trafficAnalytics = require('../services/trafficAnalytics');
const campaignAnalytics = require('../services/campaignAnalytics');
const apiKeyAuth = require('../middleware/apiKeyAuth');

/**
 * GET /api/analytics/:email/overview
 * Get traffic analytics overview data
 */
router.get('/:email/overview', apiKeyAuth, async (req, res) => {
  try {
    const { campaignIds } = req.query;
    const ids = campaignIds ? campaignIds.split(',') : null;
    const userEmail = req.params.email; // Get user email from route params
    
    const analyticsData = await trafficAnalytics.getAnalyticsData(ids, userEmail);
    
    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/:email/live-sessions
 * Get live/recent session activity
 */
router.get('/:email/live-sessions', apiKeyAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userEmail = req.params.email; // Get user email from route params
    const liveSessions = await trafficAnalytics.getLiveSessionActivity(limit, userEmail);
    
    res.json({
      success: true,
      data: liveSessions
    });
  } catch (error) {
    console.error('Error fetching live sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch live sessions',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/:email/session-history
 * Get session history for the table
 */
router.get('/:email/session-history', apiKeyAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userEmail = req.params.email; // Get user email from route params
    const sessionHistory = await trafficAnalytics.getSessionHistory(limit, userEmail);
    
    res.json({
      success: true,
      data: sessionHistory
    });
  } catch (error) {
    console.error('Error fetching session history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session history',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/:email/stats
 * Get quick stats for dashboard
 */
router.get('/:email/stats', apiKeyAuth, async (req, res) => {
  try {
    const userEmail = req.params.email; // Get user email from route params
    const analyticsData = await trafficAnalytics.getAnalyticsData(null, userEmail);
    
    res.json({
      success: true,
      data: {
        online: analyticsData.overview.activeSessions,
        total: analyticsData.overview.totalSessions,
        totalVisits: analyticsData.overview.totalVisits, // Add this field
        avgDuration: analyticsData.overview.avgDuration,
        mobile: analyticsData.overview.mobileCount,
        desktop: analyticsData.overview.desktopCount,
        completed: analyticsData.overview.completedSessions,
        bounced: analyticsData.overview.bouncedSessions,
        efficiency: analyticsData.overview.efficiency, // Add efficiency
        bounceRate: analyticsData.overview.bounceRate, // Add bounce rate
        totalCampaigns: analyticsData.overview.totalCampaigns, // Add campaign counts
        activeCampaigns: analyticsData.overview.activeCampaigns,
        sourcesStats: analyticsData.overview.sourcesStats // Add sources
      }
    });
  } catch (error) {
    console.error('Error fetching analytics stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics stats',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/:email/campaign/:campaignId
 * Get analytics data for a specific campaign
 */
router.get('/:email/campaign/:campaignId', apiKeyAuth, async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userEmail = req.params.email; // Get user email from route params
    const analyticsData = await trafficAnalytics.getAnalyticsData([campaignId], userEmail);
    
    const campaignData = analyticsData.campaigns[campaignId];
    if (!campaignData) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found or no data available'
      });
    }

    res.json({
      success: true,
      data: {
        campaign: campaignData,
        overview: analyticsData.overview,
        timeSeries: analyticsData.timeSeries,
        sources: analyticsData.sources
      }
    });
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign analytics',
      error: error.message
    });
  }
});

module.exports = router;
