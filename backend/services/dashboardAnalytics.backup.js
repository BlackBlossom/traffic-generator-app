// dashboardAnalytics.js
// Dashboard-specific analytics service

const Campaign = require('../models/Campaigns');
const trafficAnalytics = require('./trafficAnalytics');

class DashboardAnalytics {
  constructor() {
    this.cacheTimeout = 60000; // 1 minute cache
    this.cache = new Map();
  }

  // Get dashboard analytics data
  async getDashboardAnalytics(userEmail = null) {
    try {
      const cacheKey = `dashboard:${userEmail || 'all'}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Get base analytics data
      const analyticsData = await trafficAnalytics.getAnalyticsData(null, userEmail);
      
      // Get additional dashboard-specific metrics
      const dashboardData = {
        ...analyticsData,
        dashboard: {
          quickStats: await this.getQuickStats(userEmail),
          recentCampaigns: await this.getRecentCampaigns(userEmail),
          performanceMetrics: await this.getPerformanceMetrics(userEmail),
          systemHealth: await this.getSystemHealth()
        }
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: dashboardData,
        timestamp: Date.now()
      });

      return dashboardData;

    } catch (error) {
      console.error('❌ Error getting dashboard analytics:', error);
      throw error;
    }
  }

  // Get quick stats for dashboard cards
  async getQuickStats(userEmail = null) {
    try {
      let query = {};
      if (userEmail) {
        query.userEmail = userEmail;
      }

      const campaigns = await Campaign.find(query);
      
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Today's stats
      const todayCampaigns = campaigns.filter(c => 
        new Date(c.updatedAt) > oneDayAgo
      );

      // This week's stats
      const weekCampaigns = campaigns.filter(c => 
        new Date(c.updatedAt) > oneWeekAgo
      );

      return {
        totalCampaigns: campaigns.length,
        activeCampaigns: campaigns.filter(c => c.isActive).length,
        todaySessions: todayCampaigns.reduce((sum, c) => sum + (c.completedSessions || 0), 0),
        weekSessions: weekCampaigns.reduce((sum, c) => sum + (c.completedSessions || 0), 0),
        totalSessions: campaigns.reduce((sum, c) => sum + (c.completedSessions || 0), 0),
        totalClicks: campaigns.reduce((sum, c) => sum + (c.adClicks || 0), 0),
        avgSessionDuration: this.calculateAverageSessionDuration(campaigns)
      };

    } catch (error) {
      console.error('❌ Error getting quick stats:', error);
      return {
        totalCampaigns: 0,
        activeCampaigns: 0,
        todaySessions: 0,
        weekSessions: 0,
        totalSessions: 0,
        totalClicks: 0,
        avgSessionDuration: 0
      };
    }
  }

  // Get recent campaigns for dashboard
  async getRecentCampaigns(userEmail = null, limit = 5) {
    try {
      let query = {};
      if (userEmail) {
        query.userEmail = userEmail;
      }

      const campaigns = await Campaign.find(query)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('url isActive completedSessions totalSessions updatedAt status adClicks geo');

      return campaigns.map(campaign => ({
        id: campaign._id,
        url: campaign.url,
        isActive: campaign.isActive,
        progress: campaign.totalSessions > 0 ? 
          ((campaign.completedSessions || 0) / campaign.totalSessions * 100).toFixed(1) : 0,
        completedSessions: campaign.completedSessions || 0,
        totalSessions: campaign.totalSessions || 0,
        adClicks: campaign.adClicks || 0,
        country: campaign.geo || 'Unknown',
        lastUpdated: campaign.updatedAt,
        status: campaign.status || 'pending'
      }));

    } catch (error) {
      console.error('❌ Error getting recent campaigns:', error);
      return [];
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(userEmail = null) {
    try {
      let query = {};
      if (userEmail) {
        query.userEmail = userEmail;
      }

      const campaigns = await Campaign.find(query);
      
      const totalSessions = campaigns.reduce((sum, c) => sum + (c.completedSessions || 0), 0);
      const totalClicks = campaigns.reduce((sum, c) => sum + (c.adClicks || 0), 0);
      const activeCampaigns = campaigns.filter(c => c.isActive).length;
      const completedCampaigns = campaigns.filter(c => !c.isActive && (c.completedSessions || 0) >= (c.totalSessions || 1)).length;

      // Calculate success rate
      const successRate = campaigns.length > 0 ? 
        ((completedCampaigns / campaigns.length) * 100).toFixed(1) : 0;

      // Calculate average completion time (estimate)
      const avgCompletionTime = this.estimateAverageCompletionTime(campaigns);

      return {
        totalSessions,
        totalClicks,
        clickThroughRate: totalSessions > 0 ? ((totalClicks / totalSessions) * 100).toFixed(2) : 0,
        activeCampaigns,
        completedCampaigns,
        successRate: parseFloat(successRate),
        avgCompletionTime
      };

    } catch (error) {
      console.error('❌ Error getting performance metrics:', error);
      return {
        totalSessions: 0,
        totalClicks: 0,
        clickThroughRate: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        successRate: 0,
        avgCompletionTime: 0
      };
    }
  }

  // Get system health metrics
  async getSystemHealth() {
    try {
      const activeCampaigns = await Campaign.countDocuments({ isActive: true });
      const totalCampaigns = await Campaign.countDocuments();
      
      // Simple health calculation based on active vs total campaigns
      const healthScore = totalCampaigns > 0 ? 
        Math.min(100, (activeCampaigns / totalCampaigns * 100) + 75) : 100;

      return {
        healthScore: Math.round(healthScore),
        activeCampaigns,
        totalCampaigns,
        status: healthScore > 90 ? 'excellent' : 
                healthScore > 70 ? 'good' : 
                healthScore > 50 ? 'fair' : 'poor',
        uptime: '99.9%', // Static for now
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Error getting system health:', error);
      return {
        healthScore: 0,
        activeCampaigns: 0,
        totalCampaigns: 0,
        status: 'error',
        uptime: '0%',
        lastUpdated: new Date().toISOString()
      };
    }
  }

  // Calculate average session duration
  calculateAverageSessionDuration(campaigns) {
    const durations = campaigns
      .map(c => {
        if (c.visitDurationMin && c.visitDurationMax) {
          return (c.visitDurationMin + c.visitDurationMax) / 2;
        }
        return c.visitDuration || 30; // Default fallback
      })
      .filter(d => d > 0);
    
    if (durations.length === 0) return 30;
    
    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    return Math.round(average);
  }

  // Estimate average completion time
  estimateAverageCompletionTime(campaigns) {
    const completedCampaigns = campaigns.filter(c => 
      !c.isActive && c.startedAt && c.completedAt
    );

    if (completedCampaigns.length === 0) return 0;

    const totalTime = completedCampaigns.reduce((sum, c) => {
      const start = new Date(c.startedAt);
      const end = new Date(c.completedAt);
      return sum + (end - start);
    }, 0);

    // Return average in minutes
    return Math.round(totalTime / completedCampaigns.length / (1000 * 60));
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('🧹 Dashboard analytics cache cleared');
  }

  // Get cache stats
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      cacheTimeout: this.cacheTimeout,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Create and export singleton instance
const dashboardAnalytics = new DashboardAnalytics();

module.exports = dashboardAnalytics;
