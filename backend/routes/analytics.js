// routes/analytics.js
const express = require('express');
const router = express.Router();
const trafficAnalytics = require('../services/trafficAnalytics');
const campaignAnalytics = require('../services/campaignAnalytics');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth middleware to all analytics routes
router.use(authMiddleware);

/**
 * GET /api/analytics/overview
 * Get traffic analytics overview data
 */
router.get('/overview', async (req, res) => {
  try {
    const { campaignIds } = req.query;
    const ids = campaignIds ? campaignIds.split(',') : null;
    const userEmail = req.user?.email; // Get user email from auth middleware
    
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
 * GET /api/analytics/live-sessions
 * Get live/recent session activity
 */
router.get('/live-sessions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userEmail = req.user?.email; // Get user email from auth middleware
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
 * GET /api/analytics/campaign/:campaignId/report
 * Get permanent campaign analytics report from database
 */
router.get('/campaign/:campaignId/report', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaignReport = await campaignAnalytics.getCampaignReport(campaignId);
    
    res.json({
      success: true,
      data: campaignReport
    });
  } catch (error) {
    console.error('Error fetching campaign report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign report',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/campaign/:campaignId
 * Get detailed analytics for a specific campaign (Redis-based, real-time)
 */
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userEmail = req.user?.email; // Get user email from auth middleware
    
    const campaignAnalytics = await trafficAnalytics.getCampaignAnalytics(campaignId, userEmail);
    
    res.json({
      success: true,
      data: campaignAnalytics
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

/**
 * GET /api/analytics/session-history
 * Get session history for the table
 */
router.get('/session-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const userEmail = req.user?.email; // Get user email from auth middleware
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
 * GET /api/analytics/campaign/:campaignId
 * Get analytics data for a specific campaign
 */
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const userEmail = req.user?.email; // Get user email from auth middleware
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

/**
 * GET /api/analytics/stats
 * Get quick stats for dashboard
 */
router.get('/stats', async (req, res) => {
  try {
    const userEmail = req.user?.email; // Get user email from auth middleware
    const analyticsData = await trafficAnalytics.getAnalyticsData(null, userEmail);
    
    res.json({
      success: true,
      data: {
        online: analyticsData.overview.activeSessions,
        total: analyticsData.overview.totalSessions,
        avgDuration: analyticsData.overview.avgDuration,
        mobile: analyticsData.overview.mobileCount,
        desktop: analyticsData.overview.desktopCount,
        completed: analyticsData.overview.completedSessions,
        bounced: analyticsData.overview.bouncedSessions
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

module.exports = router;
