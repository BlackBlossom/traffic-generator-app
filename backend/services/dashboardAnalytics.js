// dashboardAnalytics.js
// Enhanced dashboard analytics service for aggregating user data with corrected calculations

const User = require('../models/User');
const Campaign = require('../models/Campaigns');

class DashboardAnalytics {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Get aggregated dashboard analytics for a user
  async getDashboardAnalytics(userEmail = null) {
    try {
      if (!userEmail) {
        throw new Error('User email is required');
      }

      console.log(`📊 Calculating dashboard analytics for user: ${userEmail}`);

      // Get user and their campaigns with analytics
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        throw new Error(`User not found: ${userEmail}`);
      }

      const campaigns = user.campaigns || [];
      console.log(`Found ${campaigns.length} campaigns for user`);
      
      // Calculate comprehensive dashboard metrics
      const analytics = this.calculateEnhancedDashboardMetrics(campaigns);
      
      // Add recent campaigns data
      analytics.recentCampaigns = this.getRecentCampaignsData(campaigns);
      
      // Update user's dashboard analytics in DB
      await this.updateUserDashboardAnalytics(userEmail, analytics);
      
      console.log(`✅ Dashboard analytics calculated:`, {
        totalVisits: analytics.totalVisits,
        totalCampaigns: analytics.totalCampaigns,
        activeCampaigns: analytics.activeCampaigns,
        totalEfficiency: analytics.totalEfficiency
      });
      
      return analytics;
    } catch (error) {
      console.error('❌ Error getting dashboard analytics:', error);
      throw error;
    }
  }

  // Calculate enhanced dashboard metrics with corrected logic
  calculateEnhancedDashboardMetrics(campaigns) {
    // Basic campaign counts
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.isActive).length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

    // Initialize aggregated metrics
    let totalVisits = 0;
    let totalSessions = 0;
    let activeSessions = 0;
    let completedSessions = 0;
    let bouncedSessions = 0;
    let erroredSessions = 0;
    let totalDuration = 0;
    let totalMobile = 0;
    let totalDesktop = 0;
    let organicTotal = 0;
    let directTotal = 0;
    let socialTotal = 0;
    let referralTotal = 0;
    let totalEfficiencySum = 0;
    let campaignsWithData = 0;

    campaigns.forEach(campaign => {
      const analytics = campaign.analytics || {};
      
      // Session metrics
      const campaignSessions = analytics.totalSessions || 0;
      const campaignCompleted = analytics.completedSessions || 0;
      const campaignBounced = analytics.bouncedSessions || 0;
      const campaignErrored = analytics.erroredSessions || 0;
      const campaignActive = analytics.activeSessions || 0;
      const campaignDuration = analytics.totalDuration || 0;
      
      totalSessions += campaignSessions;
      completedSessions += campaignCompleted;
      bouncedSessions += campaignBounced;
      erroredSessions += campaignErrored;
      activeSessions += campaignActive;
      totalDuration += campaignDuration;
      
      // Use completedSessions as totalVisits (as completed includes successful + bounced)
      totalVisits += campaignCompleted;

      // Device breakdown
      totalMobile += analytics.devices?.mobile || 0;
      totalDesktop += analytics.devices?.desktop || 0;

      // Traffic sources
      organicTotal += analytics.sources?.organic || 0;
      directTotal += analytics.sources?.direct || 0;
      socialTotal += analytics.sources?.social || 0;
      referralTotal += analytics.sources?.referral || 0;

      // Calculate efficiency for campaigns with data
      if (campaignSessions > 0) {
        // Use corrected efficiency: completedSessions / totalSessions * 100
        const efficiency = analytics.efficiency || ((campaignCompleted / campaignSessions) * 100);
        totalEfficiencySum += efficiency;
        campaignsWithData++;
      }
    });

    // Calculate averages and rates
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    
    // Bounce rate: bouncedSessions / completedSessions * 100
    const bounceRate = completedSessions > 0 ? Math.round((bouncedSessions / completedSessions) * 100) : 0;
    
    // Overall efficiency: average of all campaign efficiencies
    const totalEfficiency = campaignsWithData > 0 ? Math.round(totalEfficiencySum / campaignsWithData) : 0;

    // Calculate traffic source percentages
    const totalSourceTraffic = organicTotal + directTotal + socialTotal + referralTotal;
    const trafficSources = {
      organic: totalSourceTraffic > 0 ? Math.round((organicTotal / totalSourceTraffic) * 100) : 0,
      direct: totalSourceTraffic > 0 ? Math.round((directTotal / totalSourceTraffic) * 100) : 0,
      social: totalSourceTraffic > 0 ? Math.round((socialTotal / totalSourceTraffic) * 100) : 0,
      referral: totalSourceTraffic > 0 ? Math.round((referralTotal / totalSourceTraffic) * 100) : 0
    };

    // Find top performing campaign by visits
    let topCampaign = {
      name: 'No campaigns',
      visits: 0,
      efficiency: 0
    };

    if (campaigns.length > 0) {
      const bestCampaign = campaigns.reduce((best, current) => {
        const currentVisits = current.analytics?.completedSessions || 0;
        const bestVisits = best.analytics?.completedSessions || 0;
        return currentVisits > bestVisits ? current : best;
      });

      if (bestCampaign && bestCampaign.analytics?.completedSessions > 0) {
        topCampaign = {
          name: this.formatUrl(bestCampaign.url) || 'Unknown',
          visits: bestCampaign.analytics.completedSessions,
          efficiency: bestCampaign.analytics.efficiency || this.calculateCampaignEfficiency(bestCampaign)
        };
      }
    }

    // Proxy data (placeholder for future implementation)
    const totalProxies = 0;
    const activeProxies = 0;

    return {
      // Core metrics
      totalVisits,
      totalSessions,
      activeSessions,
      completedSessions,
      bouncedSessions,
      erroredSessions,
      bounceRate,
      avgDuration,
      
      // Proxy metrics (placeholder)
      totalProxies,
      activeProxies,
      
      // Campaign metrics
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      
      // Performance metrics
      totalEfficiency,
      
      // Traffic distribution
      trafficSources,
      
      // Top performer
      topCampaign,
      
      // Device distribution
      deviceDistribution: {
        mobile: totalMobile,
        desktop: totalDesktop,
        mobilePercentage: (totalMobile + totalDesktop) > 0 ? Math.round((totalMobile / (totalMobile + totalDesktop)) * 100) : 30,
        desktopPercentage: (totalMobile + totalDesktop) > 0 ? Math.round((totalDesktop / (totalMobile + totalDesktop)) * 100) : 70
      },
      
      // Metadata
      lastUpdated: new Date()
    };
  }

  // Get recent campaigns data for display
  getRecentCampaignsData(campaigns, limit = 5) {
    return campaigns
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, limit)
      .map(campaign => {
        const analytics = campaign.analytics || {};
        return {
          _id: campaign._id,
          name: this.formatUrl(campaign.url),
          url: campaign.url,
          isActive: campaign.isActive,
          status: campaign.status || (campaign.isActive ? 'active' : 'inactive'),
          visits: analytics.completedSessions || 0,
          bounce: analytics.bounceRate || 0,
          efficiency: analytics.efficiency || this.calculateCampaignEfficiency(campaign),
          totalSessions: analytics.totalSessions || 0,
          activeSessions: analytics.activeSessions || 0,
          avgDuration: analytics.avgDuration || 0,
          createdAt: campaign.createdAt,
          updatedAt: campaign.updatedAt
        };
      });
  }

  // Calculate efficiency for a single campaign
  calculateCampaignEfficiency(campaign) {
    const analytics = campaign.analytics || {};
    const completed = analytics.completedSessions || 0;
    const total = analytics.totalSessions || 0;
    
    if (total === 0) return 0;
    // Corrected efficiency: completedSessions / totalSessions * 100
    return Math.round((completed / total) * 100);
  }

  // Format URL for display
  formatUrl(url) {
    if (!url) return 'Unknown';
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  // Update user's dashboard analytics in database
  async updateUserDashboardAnalytics(userEmail, analyticsData) {
    try {
      await User.findOneAndUpdate(
        { email: userEmail },
        {
          'dashboardAnalytics.totalVisits': analyticsData.totalVisits,
          'dashboardAnalytics.totalSessions': analyticsData.totalSessions,
          'dashboardAnalytics.activeSessions': analyticsData.activeSessions,
          'dashboardAnalytics.bounceRate': analyticsData.bounceRate,
          'dashboardAnalytics.avgDuration': analyticsData.avgDuration,
          'dashboardAnalytics.totalProxies': analyticsData.totalProxies,
          'dashboardAnalytics.activeProxies': analyticsData.activeProxies,
          'dashboardAnalytics.totalCampaigns': analyticsData.totalCampaigns,
          'dashboardAnalytics.activeCampaigns': analyticsData.activeCampaigns,
          'dashboardAnalytics.completedCampaigns': analyticsData.completedCampaigns,
          'dashboardAnalytics.trafficSources': analyticsData.trafficSources,
          'dashboardAnalytics.topCampaign': analyticsData.topCampaign,
          'dashboardAnalytics.totalEfficiency': analyticsData.totalEfficiency,
          'dashboardAnalytics.lastUpdated': analyticsData.lastUpdated
        },
        { upsert: true }
      );
      
      console.log(`✅ Dashboard analytics saved to database for user: ${userEmail}`);
    } catch (error) {
      console.error('❌ Error updating user dashboard analytics:', error);
    }
  }

  // Update analytics when campaign changes
  async updateOnCampaignChange(userEmail) {
    try {
      await this.getDashboardAnalytics(userEmail);
      console.log(`✅ Dashboard analytics updated for user: ${userEmail}`);
    } catch (error) {
      console.error(`❌ Error updating dashboard analytics for ${userEmail}:`, error);
    }
  }

  // Get quick stats without full calculation (for performance)
  async getQuickStats(userEmail) {
    try {
      const user = await User.findOne({ email: userEmail }).populate('campaigns');
      if (!user) {
        throw new Error(`User not found: ${userEmail}`);
      }

      const campaigns = user.campaigns || [];
      const totalCampaigns = campaigns.length;
      const activeCampaigns = campaigns.filter(c => c.isActive).length;
      
      // Get cached dashboard data if available
      const cachedData = user.dashboardAnalytics;
      
      return {
        totalCampaigns,
        activeCampaigns,
        totalVisits: cachedData?.totalVisits || 0,
        bounceRate: cachedData?.bounceRate || 0,
        totalEfficiency: cachedData?.totalEfficiency || 0,
        activeSessions: cachedData?.activeSessions || 0,
        lastUpdated: cachedData?.lastUpdated || new Date()
      };
    } catch (error) {
      console.error('❌ Error getting quick stats:', error);
      throw error;
    }
  }

  // Clear cache for specific user
  clearUserCache(userEmail) {
    for (const key of this.cache.keys()) {
      if (key.includes(userEmail)) {
        this.cache.delete(key);
      }
    }
  }

  // Clear all cache
  clearAllCache() {
    this.cache.clear();
    console.log('🧹 Dashboard analytics cache cleared');
  }
}

// Create and export singleton instance
const dashboardAnalytics = new DashboardAnalytics();

module.exports = dashboardAnalytics;
