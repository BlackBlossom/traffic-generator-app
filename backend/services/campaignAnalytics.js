// campaignAnalytics.js
// Campaign-specific analytics and performance tracking

const Campaign = require('../models/Campaigns');
const redisLogger = require('./redisLogger');

class CampaignAnalytics {
  constructor() {
    this.performanceCache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  // Initialize analytics for a new campaign
  async initializeCampaignAnalytics(campaignId) {
    try {
      console.log(`🚀 Initializing analytics for campaign ${campaignId}`);
      
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Initialize campaign analytics data
      const updates = {
        completedSessions: 0,
        totalSessions: campaign.totalSessions || 0,
        adClicks: 0,
        status: campaign.isActive ? 'active' : 'pending',
        startedAt: campaign.isActive ? new Date() : null,
        lastUpdated: new Date()
      };

      await Campaign.findByIdAndUpdate(campaignId, updates);
      
      // Initialize Redis logging for this campaign
      await redisLogger.initializeCampaignLogs(campaignId);
      
      console.log(`✅ Analytics initialized for campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error initializing campaign analytics for ${campaignId}:`, error);
      throw error;
    }
  }

  // Get detailed analytics for a specific campaign
  async getCampaignAnalytics(campaignId, includeHistory = true) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const analytics = {
        campaign: {
          id: campaign._id,
          url: campaign.url,
          isActive: campaign.isActive,
          status: campaign.status || 'pending',
          created: campaign.createdAt,
          updated: campaign.updatedAt
        },
        performance: {
          completedSessions: campaign.completedSessions || 0,
          totalSessions: campaign.totalSessions || 0,
          adClicks: campaign.adClicks || 0,
          progress: this.calculateProgress(campaign),
          clickThroughRate: this.calculateCTR(campaign),
          estimatedTimeRemaining: this.estimateTimeRemaining(campaign)
        },
        configuration: {
          deviceDistribution: {
            desktop: campaign.desktopPercentage || 70,
            mobile: 100 - (campaign.desktopPercentage || 70)
          },
          targeting: {
            geo: campaign.geo || 'Unknown',
            visitDuration: {
              min: campaign.visitDurationMin || 20,
              max: campaign.visitDurationMax || 40
            },
            concurrent: campaign.concurrent || 1,
            delay: campaign.delay || 0
          },
          socialMedia: campaign.social || {},
          adTargeting: {
            selectors: campaign.adSelectors || '',
            xPath: campaign.adsXPath || ''
          }
        }
      };

      // Include log history if requested
      if (includeHistory) {
        analytics.logs = await redisLogger.fetchLogs(campaignId, null, 100);
        analytics.logCount = await redisLogger.getLogCount(campaignId);
      }

      return analytics;

    } catch (error) {
      console.error(`❌ Error getting campaign analytics for ${campaignId}:`, error);
      throw error;
    }
  }

  // Get detailed campaign report from database
  async getCampaignReport(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      const report = {
        campaign: {
          id: campaign._id,
          url: campaign.url,
          geo: campaign.geo,
          isActive: campaign.isActive,
          status: campaign.status || 'pending',
          created: campaign.createdAt,
          updated: campaign.updatedAt
        },
        performance: {
          completedSessions: campaign.completedSessions || 0,
          totalSessions: campaign.totalSessions || 0,
          adClicks: campaign.adClicks || 0,
          progress: this.calculateProgress(campaign),
          clickThroughRate: this.calculateCTR(campaign),
          efficiency: this.calculateEfficiency(campaign)
        },
        targeting: {
          geo: campaign.geo || 'Unknown',
          deviceDistribution: {
            desktop: campaign.desktopPercentage || 70,
            mobile: 100 - (campaign.desktopPercentage || 70)
          },
          visitDuration: {
            min: campaign.visitDurationMin || 20,
            max: campaign.visitDurationMax || 40
          },
          concurrent: campaign.concurrent || 1,
          delay: campaign.delay || 0
        },
        social: campaign.social || {
          facebook: false,
          twitter: false,
          instagram: false,
          linkedin: false,
          pinterest: false,
          reddit: false
        },
        adTracking: {
          xPathSelector: campaign.adXPath || '',
          enabled: !!campaign.adXPath
        }
      };

      return report;
    } catch (error) {
      console.error(`❌ Error getting campaign report for ${campaignId}:`, error);
      throw error;
    }
  }

  // Get performance metrics for multiple campaigns
  async getBulkCampaignMetrics(campaignIds, userEmail = null) {
    try {
      let query = { _id: { $in: campaignIds } };
      
      if (userEmail) {
        query.userEmail = userEmail;
      }

      const campaigns = await Campaign.find(query);
      
      return campaigns.map(campaign => ({
        id: campaign._id,
        url: campaign.url,
        progress: this.calculateProgress(campaign),
        completedSessions: campaign.completedSessions || 0,
        totalSessions: campaign.totalSessions || 0,
        adClicks: campaign.adClicks || 0,
        ctr: this.calculateCTR(campaign),
        isActive: campaign.isActive,
        status: campaign.status || 'pending',
        lastUpdated: campaign.updatedAt
      }));

    } catch (error) {
      console.error('❌ Error getting bulk campaign metrics:', error);
      return [];
    }
  }

  // Calculate campaign progress percentage
  calculateProgress(campaign) {
    const completed = campaign.completedSessions || 0;
    const total = campaign.totalSessions || 0;
    
    if (total === 0) return 0;
    
    const progress = (completed / total) * 100;
    return Math.min(100, Math.round(progress * 10) / 10); // Round to 1 decimal
  }

  // Calculate click-through rate
  calculateCTR(campaign) {
    const sessions = campaign.completedSessions || 0;
    const clicks = campaign.adClicks || 0;
    
    if (sessions === 0) return 0;
    
    const ctr = (clicks / sessions) * 100;
    return Math.round(ctr * 100) / 100; // Round to 2 decimals
  }

  // Calculate campaign efficiency (sessions completed vs expected based on time active)
  calculateEfficiency(campaign) {
    if (!campaign.isActive || !campaign.startedAt) {
      return 0;
    }

    const completed = campaign.completedSessions || 0;
    const total = campaign.totalSessions || 0;
    
    if (total === 0) return 0;

    const hoursActive = (Date.now() - new Date(campaign.startedAt).getTime()) / (1000 * 60 * 60);
    const expectedRate = total / 24; // Expected sessions per hour if campaign runs for 24 hours
    const expectedCompleted = Math.min(total, hoursActive * expectedRate);
    
    if (expectedCompleted === 0) return 0;
    
    const efficiency = (completed / expectedCompleted) * 100;
    return Math.round(efficiency * 10) / 10; // Round to 1 decimal
  }

  // Estimate time remaining for campaign completion
  estimateTimeRemaining(campaign) {
    if (!campaign.isActive || !campaign.startedAt) {
      return null;
    }

    const completed = campaign.completedSessions || 0;
    const total = campaign.totalSessions || 0;
    const remaining = total - completed;

    if (remaining <= 0) return 0;

    const elapsed = Date.now() - new Date(campaign.startedAt).getTime();
    const sessionsPerMs = completed > 0 ? completed / elapsed : 0;

    if (sessionsPerMs === 0) return null;

    const remainingMs = remaining / sessionsPerMs;
    return Math.round(remainingMs / (1000 * 60)); // Return in minutes
  }

  // Update campaign performance metrics
  async updateCampaignMetrics(campaignId, sessionData) {
    try {
      const updates = {};
      
      if (sessionData.completed) {
        updates.$inc = { 
          completedSessions: 1,
          ...(sessionData.adClicks && { adClicks: sessionData.adClicks })
        };
      }

      if (sessionData.error) {
        updates.error = sessionData.error;
        updates.status = 'error';
      }

      if (sessionData.status) {
        updates.status = sessionData.status;
      }

      updates.lastUpdated = new Date();

      const updatedCampaign = await Campaign.findByIdAndUpdate(
        campaignId, 
        updates, 
        { new: true }
      );

      if (updatedCampaign) {
        // Log the update
        const message = sessionData.completed ? 
          `✅ Session completed (${updatedCampaign.completedSessions}/${updatedCampaign.totalSessions})` :
          `📊 Campaign metrics updated`;
        
        await redisLogger.logCampaign(campaignId, message);
        
        // Clear cache for this campaign
        this.clearCampaignCache(campaignId);
      }

      return updatedCampaign;

    } catch (error) {
      console.error(`❌ Error updating campaign metrics for ${campaignId}:`, error);
      throw error;
    }
  }

  // Get campaign performance comparison
  async compareCampaignPerformance(campaignIds, userEmail = null) {
    try {
      const metrics = await this.getBulkCampaignMetrics(campaignIds, userEmail);
      
      if (metrics.length === 0) return null;

      const comparison = {
        campaigns: metrics,
        summary: {
          totalSessions: metrics.reduce((sum, m) => sum + m.completedSessions, 0),
          totalClicks: metrics.reduce((sum, m) => sum + m.adClicks, 0),
          averageCTR: metrics.reduce((sum, m) => sum + m.ctr, 0) / metrics.length,
          averageProgress: metrics.reduce((sum, m) => sum + m.progress, 0) / metrics.length,
          activeCampaigns: metrics.filter(m => m.isActive).length
        },
        topPerformers: {
          highestCTR: metrics.reduce((max, m) => m.ctr > max.ctr ? m : max, metrics[0]),
          mostProgress: metrics.reduce((max, m) => m.progress > max.progress ? m : max, metrics[0]),
          mostSessions: metrics.reduce((max, m) => m.completedSessions > max.completedSessions ? m : max, metrics[0])
        }
      };

      return comparison;

    } catch (error) {
      console.error('❌ Error comparing campaign performance:', error);
      return null;
    }
  }

  // Get campaign efficiency metrics
  async getCampaignEfficiency(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return null;

      const efficiency = {
        sessionEfficiency: this.calculateSessionEfficiency(campaign),
        timeEfficiency: this.calculateTimeEfficiency(campaign),
        adEfficiency: this.calculateAdEfficiency(campaign),
        overallScore: 0
      };

      // Calculate overall efficiency score (0-100)
      efficiency.overallScore = Math.round(
        (efficiency.sessionEfficiency + efficiency.timeEfficiency + efficiency.adEfficiency) / 3
      );

      return efficiency;

    } catch (error) {
      console.error(`❌ Error calculating campaign efficiency for ${campaignId}:`, error);
      return null;
    }
  }

  // Calculate session efficiency (completion rate)
  calculateSessionEfficiency(campaign) {
    const completed = campaign.completedSessions || 0;
    const total = campaign.totalSessions || 0;
    
    if (total === 0) return 0;
    
    return Math.round((completed / total) * 100);
  }

  // Calculate time efficiency
  calculateTimeEfficiency(campaign) {
    if (!campaign.startedAt || !campaign.isActive) return 100;

    const elapsed = Date.now() - new Date(campaign.startedAt).getTime();
    const expectedDuration = this.calculateExpectedDuration(campaign);
    
    if (expectedDuration === 0) return 100;
    
    const efficiency = Math.max(0, 100 - ((elapsed - expectedDuration) / expectedDuration * 100));
    return Math.round(efficiency);
  }

  // Calculate ad targeting efficiency
  calculateAdEfficiency(campaign) {
    const sessions = campaign.completedSessions || 0;
    const clicks = campaign.adClicks || 0;
    
    if (sessions === 0) return 0;
    
    // Assume good ad efficiency is 10-30% CTR
    const ctr = (clicks / sessions) * 100;
    const efficiency = Math.min(100, (ctr / 20) * 100); // 20% CTR = 100% efficiency
    
    return Math.round(efficiency);
  }

  // Calculate expected campaign duration
  calculateExpectedDuration(campaign) {
    const totalSessions = campaign.totalSessions || 0;
    const concurrent = campaign.concurrent || 1;
    const avgSessionTime = ((campaign.visitDurationMin || 20) + (campaign.visitDurationMax || 40)) / 2;
    const delay = campaign.delay || 0;
    
    // Estimate total time in milliseconds
    const batches = Math.ceil(totalSessions / concurrent);
    const totalTime = batches * (avgSessionTime + delay) * 1000;
    
    return totalTime;
  }

  // Clear cache for specific campaign
  clearCampaignCache(campaignId) {
    for (const key of this.performanceCache.keys()) {
      if (key.includes(campaignId)) {
        this.performanceCache.delete(key);
      }
    }
  }

  // Clear all cache
  clearAllCache() {
    this.performanceCache.clear();
    console.log('🧹 Campaign analytics cache cleared');
  }

  // Get cache statistics
  getCacheStats() {
    return {
      size: this.performanceCache.size,
      timeout: this.cacheTimeout,
      keys: Array.from(this.performanceCache.keys())
    };
  }

  // Record a completed traffic session and update campaign analytics
  async recordSession(campaignId, sessionData) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Initialize analytics if not exists
      if (!campaign.analytics) {
        campaign.analytics = {
          totalVisits: 0,
          completedSessions: 0,
          bouncedSessions: 0,
          devices: {
            desktop: 0,
            mobile: 0
          },
          sources: {
            organic: 0,
            direct: 0,
            social: 0,
            referral: 0
          },
          averageSessionDuration: 0
        };
      }

      // Update analytics based on session data
      const analytics = campaign.analytics;
      
      // Update visit counts
      analytics.totalVisits += 1;
      
      if (sessionData.completed) {
        analytics.completedSessions += 1;
      }
      
      if (sessionData.bounced) {
        analytics.bouncedSessions += 1;
      }

      // Update device stats
      if (sessionData.device === 'Desktop') {
        analytics.devices.desktop += 1;
      } else {
        analytics.devices.mobile += 1;
      }

      // Update traffic source stats
      const source = (sessionData.source || 'Direct').toLowerCase();
      if (analytics.sources[source] !== undefined) {
        analytics.sources[source] += 1;
      } else {
        analytics.sources.direct += 1; // Default fallback
      }

      // Update average session duration
      if (sessionData.duration && analytics.completedSessions > 0) {
        const totalDuration = (analytics.averageSessionDuration * (analytics.completedSessions - 1)) + sessionData.duration;
        analytics.averageSessionDuration = Math.round(totalDuration / analytics.completedSessions);
      }

      // Save updated campaign analytics
      campaign.analytics = analytics;
      campaign.completedSessions = analytics.completedSessions; // Keep legacy field in sync
      campaign.lastUpdated = new Date();
      
      await campaign.save();
      
      console.log(`✅ Session analytics recorded for campaign ${campaignId}:`, {
        totalVisits: analytics.totalVisits,
        completed: sessionData.completed,
        device: sessionData.device,
        source: sessionData.source,
        duration: sessionData.duration
      });
      
      return true;
    } catch (error) {
      console.error(`❌ Error recording session analytics for campaign ${campaignId}:`, error);
      throw error;
    }
  }

  // Finalize campaign analytics when stopping
  async finalizeCampaignAnalytics(campaignId) {
    try {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      console.log(`🏁 Finalizing analytics for campaign ${campaignId}`);
      
      // Update final status and timestamps
      const updates = {
        status: 'completed',
        lastUpdated: new Date(),
        finishedAt: new Date()
      };

      await Campaign.findByIdAndUpdate(campaignId, updates);
      
      console.log(`✅ Analytics finalized for campaign ${campaignId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error finalizing campaign analytics for ${campaignId}:`, error);
      throw error;
    }
  }
}

// Create and export singleton instance
const campaignAnalytics = new CampaignAnalytics();

module.exports = campaignAnalytics;
