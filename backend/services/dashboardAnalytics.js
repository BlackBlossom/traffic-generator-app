// dashboardAnalytics.js
// Dashboard analytics service for aggregating user data

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

      // Get user campaigns
      const campaigns = await Campaign.find({ userEmail }).lean();
      
      // Calculate real-time analytics from campaigns
      const analytics = this.calculateDashboardMetrics(campaigns);
      
      // Update user's dashboard analytics in DB
      await this.updateUserDashboardAnalytics(userEmail, analytics);
      
      return analytics;
    } catch (error) {
      console.error('❌ Error getting dashboard analytics:', error);
      throw error;
    }
  }

  // Calculate dashboard metrics from campaign data
  calculateDashboardMetrics(campaigns) {
    // Basic campaign counts
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.isActive).length;
    const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;

    // Aggregate analytics from all campaigns
    let totalVisits = 0;
    let totalSessions = 0;
    let activeSessions = 0;
    let totalDuration = 0;
    let totalBouncedSessions = 0;
    let totalMobile = 0;
    let totalDesktop = 0;
    let organicTotal = 0;
    let directTotal = 0;
    let socialTotal = 0;
    let referralTotal = 0;
    let totalEfficiencySum = 0;
    let campaignsWithEfficiency = 0;

    campaigns.forEach(campaign => {
      // Use analytics data from campaign if available
      const analytics = campaign.analytics || {};
      
      totalVisits += analytics.totalVisits || analytics.completedSessions || 0;
      totalSessions += analytics.totalSessions || 0;
      totalBouncedSessions += analytics.bouncedSessions || 0;
      totalDuration += analytics.totalDuration || 0;

      // Device breakdown
      totalMobile += analytics.devices?.mobile || 0;
      totalDesktop += analytics.devices?.desktop || 0;

      // Traffic sources
      organicTotal += analytics.sources?.organic || 0;
      directTotal += analytics.sources?.direct || 0;
      socialTotal += analytics.sources?.social || 0;
      referralTotal += analytics.sources?.referral || 0;

      // Calculate efficiency for active campaigns
      if (campaign.isActive) {
        activeSessions += 1; // Count active campaigns as active sessions
        
        // Calculate efficiency: (completed sessions / total sessions) * 100
        const completed = analytics.completedSessions || 0;
        const total = campaign.totalSessions || analytics.totalSessions || 0;
        if (total > 0) {
          const efficiency = (completed / total) * 100;
          totalEfficiencySum += efficiency;
          campaignsWithEfficiency++;
        }
      }
    });

    // Calculate averages and rates
    const avgDuration = totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0;
    const bounceRate = totalVisits > 0 ? Math.round((totalBouncedSessions / totalVisits) * 100) : 0;
    const totalEfficiency = campaignsWithEfficiency > 0 ? Math.round(totalEfficiencySum / campaignsWithEfficiency) : 0;

    // Calculate traffic source percentages
    const totalSourceTraffic = organicTotal + directTotal + socialTotal + referralTotal;
    const trafficSources = {
      organic: totalSourceTraffic > 0 ? Math.round((organicTotal / totalSourceTraffic) * 100) : 0,
      direct: totalSourceTraffic > 0 ? Math.round((directTotal / totalSourceTraffic) * 100) : 0,
      social: totalSourceTraffic > 0 ? Math.round((socialTotal / totalSourceTraffic) * 100) : 0,
      referral: totalSourceTraffic > 0 ? Math.round((referralTotal / totalSourceTraffic) * 100) : 0
    };

    // Find top performing campaign
    let topCampaign = {
      name: '',
      visits: 0,
      efficiency: 0
    };

    if (campaigns.length > 0) {
      const bestCampaign = campaigns.reduce((best, current) => {
        const currentVisits = current.analytics?.totalVisits || current.analytics?.completedSessions || 0;
        const bestVisits = best.analytics?.totalVisits || best.analytics?.completedSessions || 0;
        return currentVisits > bestVisits ? current : best;
      });

      if (bestCampaign) {
        topCampaign = {
          name: bestCampaign.url || 'Unknown',
          visits: bestCampaign.analytics?.totalVisits || bestCampaign.analytics?.completedSessions || 0,
          efficiency: this.calculateCampaignEfficiency(bestCampaign)
        };
      }
    }

    return {
      totalVisits,
      totalSessions,
      activeSessions,
      bounceRate,
      avgDuration,
      totalProxies: 0, // To be implemented when proxy system is added
      activeProxies: 0, // To be implemented when proxy system is added
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      trafficSources,
      topCampaign,
      totalEfficiency,
      lastUpdated: new Date()
    };
  }

  // Calculate efficiency for a single campaign
  calculateCampaignEfficiency(campaign) {
    const analytics = campaign.analytics || {};
    const completed = analytics.completedSessions || 0;
    const total = campaign.totalSessions || analytics.totalSessions || 0;
    
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
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
}

// Create and export singleton instance
const dashboardAnalytics = new DashboardAnalytics();

module.exports = dashboardAnalytics;
